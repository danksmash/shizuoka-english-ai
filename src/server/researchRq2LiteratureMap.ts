function csvCell(value: unknown) {
  const raw = value === null || value === undefined
    ? ''
    : Array.isArray(value) ? value.join(' | ') : String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

function originLabel(origin: unknown) {
  const value = String(origin || '');
  if (value === 'adapted') return '先行研究の概念を本研究用に操作化';
  if (value === 'adapted_baseline') return '先行研究を基礎に本研究の基底機能として整理';
  if (value === 'study_specific_theory_informed') return '先行理論に依拠した本研究独自コード';
  if (value === 'study_specific_baseline') return '本研究独自の比較基準';
  return value || '未分類';
}

export function buildRq2LiteratureMapRows(codebook: Record<string, any>) {
  const refs = new Map(
    (Array.isArray(codebook.references) ? codebook.references : [])
      .map((row: any) => [String(row.id || ''), row]),
  );
  const dimensions = [
    ['参照基盤', Array.isArray(codebook.referenceBasis) ? codebook.referenceBasis : []],
    ['対話機能', Array.isArray(codebook.interactionFunction) ? codebook.interactionFunction : []],
  ] as const;

  return dimensions.flatMap(([dimension, rows]) => rows.map((row: any) => {
    const sourceIds = Array.isArray(row.sourceRefs) ? row.sourceRefs.map(String) : [];
    const sourceRows = sourceIds.map((id) => refs.get(id)).filter(Boolean);
    return {
      dimension,
      code: String(row.code || ''),
      label: String(row.label || ''),
      relationship_to_literature: originLabel(row.origin),
      operational_definition: String(row.definition || ''),
      theoretical_basis: String(row.theoreticalBasis || ''),
      primary_source_ids: sourceIds,
      primary_sources: sourceRows.map((source: any) => String(source.citation || '')),
      source_roles: sourceRows.map((source: any) => String(source.role || '')),
      inclusion_examples: Array.isArray(row.include) ? row.include : [],
      exclusion_examples: Array.isArray(row.exclude) ? row.exclude : [],
      boundary_rule: String(row.boundaryRule || ''),
      example: Array.isArray(row.examples) ? row.examples[0] || '' : '',
    };
  }));
}

export function serializeRq2LiteratureMapCsv(codebook: Record<string, any>) {
  const headers = [
    'dimension',
    'code',
    'label',
    'relationship_to_literature',
    'operational_definition',
    'theoretical_basis',
    'primary_source_ids',
    'primary_sources',
    'source_roles',
    'inclusion_examples',
    'exclusion_examples',
    'boundary_rule',
    'example',
  ];
  const rows = buildRq2LiteratureMapRows(codebook);
  return '\uFEFF' + [
    headers.map(csvCell).join(','),
    ...rows.map((row) => headers.map((header) => csvCell((row as any)[header])).join(',')),
  ].join('\n') + '\n';
}
