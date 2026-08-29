import React, { useState, useEffect } from 'react';
import { Mic, Send, Keyboard, Sparkles, ChevronUp, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { COMMON_HELP_PHRASES } from '../data/curriculum';
import type { ResearchSystemEventType } from '../dataContract';

interface SpeechInputBarProps {
  isRecording: boolean;
  transcript: string;
  isAiResponding: boolean;
  onToggleRecording: () => void;
  onSendMessage: (text: string) => void;
  onClearTranscript: () => void;
  onResearchEvent?: (type: ResearchSystemEventType, value?: string) => void;
  compact?: boolean;
}

export const SpeechInputBar: React.FC<SpeechInputBarProps> = ({ isRecording, transcript, isAiResponding, onToggleRecording, onSendMessage, onClearTranscript, onResearchEvent, compact = false }) => {
  const [manualText, setManualText] = useState('');
  const [showKeyboardInput, setShowKeyboardInput] = useState(false);
  const [showPhrases, setShowPhrases] = useState(false);
  useEffect(() => { if (transcript) setManualText(transcript); }, [transcript]);
  const handleSend = () => { const textToSend = manualText.trim(); if (!textToSend || isAiResponding) return; onResearchEvent?.('text_message_send'); onSendMessage(textToSend); setManualText(''); onClearTranscript(); };
  return <div className={`${compact ? 'p-2.5' : 'p-3 sm:p-4'} bg-white space-y-2.5`}>
    <div className="flex items-center justify-between gap-2">
      <button type="button" onClick={() => { const opening = !showPhrases; setShowPhrases(opening); if (opening) onResearchEvent?.('help_open'); }} className="min-h-10 sm:min-h-11 px-3 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-blue-600" />お助け{showPhrases ? <ChevronUp className="w-3.5 h-3.5"/> : <ChevronDown className="w-3.5 h-3.5"/>}</button>
      <button type="button" onClick={() => { const opening = !showKeyboardInput; setShowKeyboardInput(opening); if (opening) onResearchEvent?.('text_input_open'); }} className="min-h-10 sm:min-h-11 px-3 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold flex items-center gap-1.5"><Keyboard className="w-4 h-4" />文字入力</button>
    </div>
    <AnimatePresence>{showPhrases && <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} className="overflow-hidden"><div className="flex gap-1.5 overflow-x-auto pb-1">{COMMON_HELP_PHRASES.map((phrase,idx)=><button key={idx} type="button" onClick={()=>{onResearchEvent?.('help_phrase_select',`phrase_${idx+1}`);setManualText(phrase.text);setShowKeyboardInput(true);}} className="min-h-10 whitespace-nowrap flex-shrink-0 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl">{phrase.text}</button>)}</div></motion.div>}</AnimatePresence>
    {isRecording && <motion.div initial={{opacity:0,scale:.98}} animate={{opacity:1,scale:1}} className="p-2 bg-rose-50 border-2 border-rose-300 rounded-2xl"><div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 mb-1"><span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping"/>音声を聞き取り中…</div><div className="text-sm sm:text-base font-bold min-h-6">{transcript ? <span className="text-blue-700">{transcript}</span> : <span className="text-slate-400 italic font-normal">英語で話してね…</span>}</div></motion.div>}
    {showKeyboardInput && !isRecording && <motion.div initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} className="bg-slate-50 border border-slate-200 rounded-2xl p-2 flex gap-2"><input type="text" value={manualText} onChange={e=>setManualText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')handleSend();}} placeholder="英語を入力してください..." className="min-h-11 flex-1 min-w-0 bg-white border border-slate-200 rounded-xl px-3 py-2 text-base sm:text-sm font-semibold"/><button type="button" onClick={handleSend} disabled={!manualText.trim()||isAiResponding} className={`min-w-12 min-h-11 px-3 rounded-xl flex items-center justify-center ${!manualText.trim()||isAiResponding?'bg-slate-200 text-slate-400':'bg-blue-600 text-white'}`} aria-label="送信"><Send className="w-5 h-5"/></button></motion.div>}
    <motion.button whileTap={{scale:.98}} type="button" onClick={onToggleRecording} disabled={isAiResponding} className={`w-full min-h-16 py-3 px-4 rounded-2xl font-black text-base sm:text-lg flex flex-col items-center justify-center shadow-md ${isAiResponding?'bg-slate-200 text-slate-400':isRecording?'bg-rose-500 text-white ring-4 ring-rose-200 animate-pulse':'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'}`}>{isRecording?<><div className="flex items-center gap-2"><span className="w-3.5 h-3.5 bg-white rounded-full animate-ping"/><span>話し終えたら、もう1度タップ</span></div><span className="text-xs text-rose-100">タップするとAIに送ります</span></>:<><div className="flex items-center gap-2"><Mic className="w-6 h-6"/><span>タップして話す</span></div><span className="text-xs text-blue-100">Speak English</span></>}</motion.button>
  </div>;
};
