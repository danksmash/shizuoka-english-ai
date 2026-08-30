from pathlib import Path
import json

root=Path('.')
server_path=root/'server.ts'
server=server_path.read_text(encoding='utf-8')
old_import="import { buildResearchDataSets, type ResearchDatasetName } from './src/server/researchExport';"
new_import="import { buildResearchDashboardData, buildResearchExportDataSets, filterResearchExportDataSets, serializeResearchCsv, type ResearchExportDatasetName } from './src/server/researchDashboard';"
if old_import not in server:
    raise SystemExit('research export import not found')
server=server.replace(old_import,new_import,1)
start=server.find("app.get('/api/management/research.summary'")
end=server.find("\nasync function startServer()",start)
if start<0 or end<0:
    raise SystemExit('management export block not found')
block=r'''app.get('/api/management/research.summary',requireManagementRole(['researcher']),async(_req,res)=>{
  try{
    const data=buildResearchExportDataSets(await getAllSessionsForManagement());
    const classCounts:Record<string,number>={};const researchIds=new Set<string>();let latestDate='';let completeSessions=0;
    for(const row of data.sessions){const c=String(row.class_id||'');if(c)classCounts[c]=(classCounts[c]||0)+1;const rid=String(row.research_id||'');if(rid)researchIds.add(rid);const d=String(row.local_date||'');if(d>latestDate)latestDate=d;if(String(row.data_quality_flag||'')==='complete')completeSessions+=1;}
    res.setHeader('Cache-Control','no-store');return res.json({success:true,totalSessions:data.sessions.length,completeSessions,researchIdCount:researchIds.size,latestDate,classCounts});
  }catch(error:any){console.error('Research summary failed',{message:error?.message});return res.status(503).json({success:false,error:'RESEARCH_SUMMARY_UNAVAILABLE'});}
});

app.get('/api/management/research.dashboard',requireManagementRole(['researcher']),async(req,res)=>{
  try{
    const dashboard=buildResearchDashboardData(await getAllSessionsForManagement(),req.query);
    res.setHeader('Cache-Control','no-store');return res.json(dashboard);
  }catch(error:any){console.error('Research dashboard failed',{message:error?.message});return res.status(503).json({success:false,error:'RESEARCH_DASHBOARD_UNAVAILABLE'});}
});

function crc32(buffer:Buffer):number{
  let crc=0xffffffff;
  for(const byte of buffer){crc^=byte;for(let bit=0;bit<8;bit+=1)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return (crc^0xffffffff)>>>0;
}
function buildStoredZip(files:Array<{name:string;content:string}>):Buffer{
  const localParts:Buffer[]=[];const centralParts:Buffer[]=[];let offset=0;
  for(const file of files){
    const name=Buffer.from(file.name,'utf8');const data=Buffer.from(file.content,'utf8');const crc=crc32(data);
    const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0,6);local.writeUInt16LE(0,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(name.length,26);local.writeUInt16LE(0,28);
    localParts.push(local,name,data);
    const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0,8);central.writeUInt16LE(0,10);central.writeUInt32LE(crc,16);central.writeUInt32LE(data.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(name.length,28);central.writeUInt16LE(0,30);central.writeUInt16LE(0,32);central.writeUInt16LE(0,34);central.writeUInt16LE(0,36);central.writeUInt32LE(0,38);central.writeUInt32LE(offset,42);
    centralParts.push(central,name);offset+=local.length+name.length+data.length;
  }
  const centralSize=centralParts.reduce((sum,part)=>sum+part.length,0);const endRecord=Buffer.alloc(22);endRecord.writeUInt32LE(0x06054b50,0);endRecord.writeUInt16LE(files.length,8);endRecord.writeUInt16LE(files.length,10);endRecord.writeUInt32LE(centralSize,12);endRecord.writeUInt32LE(offset,16);
  return Buffer.concat([...localParts,...centralParts,endRecord]);
}

app.get('/api/management/research.bundle.zip',requireManagementRole(['researcher']),async(req,res)=>{
  try{
    const datasets=filterResearchExportDataSets(buildResearchExportDataSets(await getAllSessionsForManagement()),req.query);
    const exportedAt=new Date().toISOString();
    const names=['sessions','utterances','expressions','personas','codebook'] as const;
    const manifest={export_id:`export_${Date.now()}`,exported_at:exportedAt,schema_version:4,filters:req.query,row_counts:Object.fromEntries(names.map((name)=>[name,datasets[name].length]))};
    const files=names.map((name)=>({name:`${name}.csv`,content:serializeResearchCsv(datasets[name],name)}));
    const zip=buildStoredZip([...files,{name:'manifest.json',content:JSON.stringify(manifest,null,2)}]);
    res.setHeader('Content-Type','application/zip');res.setHeader('Content-Disposition',`attachment; filename="research-bundle-${exportedAt.slice(0,10).replace(/-/g,'')}.zip"`);res.setHeader('Cache-Control','no-store');return res.send(zip);
  }catch(error:any){console.error('Research bundle export failed',{message:error?.message});return res.status(503).json({success:false,error:'RESEARCH_BUNDLE_UNAVAILABLE'});}
});

app.get('/api/management/research.csv',requireManagementRole(['researcher']),async(req,res)=>{
  try{
    const requested=typeof req.query?.dataset==='string'?req.query.dataset:'sessions';
    const allowed=['sessions','utterances','expressions','personas','codebook'] as const;
    const dataset:ResearchExportDatasetName=(allowed as readonly string[]).includes(requested)?requested as ResearchExportDatasetName:'sessions';
    const datasets=filterResearchExportDataSets(buildResearchExportDataSets(await getAllSessionsForManagement()),req.query);
    const csv=serializeResearchCsv(datasets[dataset],dataset);
    res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="${dataset}.csv"`);res.setHeader('Cache-Control','no-store');return res.send(csv);
  }catch(error:any){console.error('Research export failed',{message:error?.message});return res.status(503).json({success:false,error:'RESEARCH_EXPORT_UNAVAILABLE'});}
});
'''
server=server[:start]+block+'\n'+server[end:]
server_path.write_text(server,encoding='utf-8')

auth_path=root/'src/server/auth.ts'
auth=auth_path.read_text(encoding='utf-8')
needle="  if (path === '/api/management/research.summary') return true;\n"
if needle not in auth:
    raise SystemExit('auth route anchor not found')
if '/api/management/research.dashboard' not in auth:
    auth=auth.replace(needle,needle+"  if (path === '/api/management/research.dashboard') return true;\n",1)
auth_path.write_text(auth,encoding='utf-8')

qa_path=root/'scripts/qa-research-integrated.ts'
qa=qa_path.read_text(encoding='utf-8')
qa=qa.replace("assert.ok(managementHardening.includes('/api/management/research.summary'),'research management UI must expose anonymous summary data');","assert.ok(managementHardening.includes('/api/management/research.dashboard'),'research management UI must expose anonymous dashboard data');")
qa_path.write_text(qa,encoding='utf-8')

package_path=root/'package.json'
pkg=json.loads(package_path.read_text(encoding='utf-8'))
scripts=pkg['scripts']
scripts['qa:research-export']='tsx scripts/qa-research-export-complete.ts'
qa_script=scripts['qa']
if 'npm run qa:dashboard' not in qa_script:
    qa_script=qa_script.replace('npm run qa:research &&','npm run qa:research && npm run qa:dashboard &&')
if 'npm run qa:research-export' not in qa_script:
    qa_script=qa_script.replace('npm run qa:dashboard &&','npm run qa:dashboard && npm run qa:research-export &&')
scripts['qa']=qa_script
package_path.write_text(json.dumps(pkg,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

print('research dashboard server patch applied')
