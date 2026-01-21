
import React, { useState } from 'react';
import { Student, ViolationOption, AttendanceState } from '../types';
import AiInsights from './AiInsights';
import { Settings, UserPlus, Upload, Trash2, Plus, Check, ShieldCheck, AlertCircle, X, Cloud, Share2, Copy, ArrowLeft, FileSpreadsheet, ListPlus, Sparkles, Heart } from 'lucide-react';

interface AdminPanelProps {
  students: Student[];
  setStudents: (students: Student[]) => void;
  violations: ViolationOption[];
  setViolations: (violations: ViolationOption[]) => void;
  attendance: AttendanceState;
  selectedDate: string;
  syncKey: string;
  onClose: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ students, setStudents, violations, setViolations, attendance, selectedDate, syncKey, onClose }) => {
  const [activeTab, setActiveTab] = useState<'sync' | 'violations' | 'students' | 'ai'>('sync');
  const [newViolation, setNewViolation] = useState('');
  const [singleStudent, setSingleStudent] = useState({ name: '', number: '' });
  const [bulkText, setBulkText] = useState('');
  const [bulkPreview, setBulkPreview] = useState<Student[]>([]);

  const shareUrl = window.location.href;

  const handleBulkParse = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    const newStudents: Student[] = lines.map((line, idx) => {
      const parts = line.split(/[\s,\t]+/).filter(p => p.trim() !== '');
      if (parts.length < 2) return null;
      
      const number = parts[0];
      const name = parts[1];
      
      const year = parseInt(number[0]);
      const classGroup = parseInt(number[1]);

      return {
        id: `std-bulk-${Date.now()}-${idx}`,
        name: name,
        studentNumber: number,
        year: isNaN(year) ? 1 : year,
        classGroup: isNaN(classGroup) ? 1 : classGroup
      };
    }).filter(s => s !== null) as Student[];

    setBulkPreview(newStudents);
  };

  const commitBulkUpload = () => {
    if (bulkPreview.length === 0) return;
    if (confirm(`${bulkPreview.length}명의 학생을 명단에 추가하시겠습니까?`)) {
      setStudents([...students, ...bulkPreview]);
      setBulkText('');
      setBulkPreview([]);
      alert('일괄 등록이 완료되었습니다.');
    }
  };

  const clearAllStudents = () => {
    if (confirm('모든 학생 명단을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      setStudents([]);
    }
  };

  return (
    <div className="bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col h-full border border-slate-200">
      <div className="bg-slate-950 px-8 py-6 flex items-center justify-between text-white shrink-0">
        <div className="flex items-center gap-3">
          <ShieldCheck className="text-pink-500" />
          <h2 className="text-xl font-black tracking-tight">관리자 설정</h2>
        </div>
        <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-full transition-colors">
          <X size={24} />
        </button>
      </div>

      <div className="flex border-b border-slate-100 bg-slate-50/50 p-2 shrink-0 overflow-x-auto scrollbar-hide">
        {[
          { id: 'sync', label: '동기화', icon: Cloud },
          { id: 'violations', label: '교칙', icon: Settings },
          { id: 'students', label: '명단', icon: UserPlus },
          { id: 'ai', label: 'AI 분석', icon: Sparkles }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 min-w-[80px] py-4 text-[11px] font-black rounded-2xl flex items-center justify-center gap-2 transition-all ${activeTab === tab.id ? 'bg-white text-pink-600 shadow-sm' : 'text-slate-400'}`}
          >
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-white">
        {activeTab === 'sync' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-pink-600 p-8 rounded-[2.5rem] text-white space-y-6 shadow-xl shadow-pink-500/20">
              <div className="space-y-2">
                <h4 className="text-2xl font-black tracking-tight">기기 동기화 링크</h4>
                <p className="text-pink-100 text-sm font-medium">이 주소를 다른 기기(아이폰 등)로 공유하면 즉시 데이터가 연결됩니다.</p>
              </div>
              <div className="bg-slate-950/20 p-4 rounded-2xl break-all text-[11px] font-mono font-bold border border-white/10">
                {shareUrl}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => { navigator.clipboard.writeText(shareUrl); alert("링크가 복사되었습니다!"); }}
                  className="bg-white text-pink-600 py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2"
                >
                  <Copy size={18} /> 링크 복사
                </button>
                <button 
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({ title: '지각관리 동기화', url: shareUrl });
                    } else {
                      alert("이 브라우저는 공유 기능을 지원하지 않습니다.");
                    }
                  }}
                  className="bg-slate-950 text-white py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2"
                >
                  <Share2 size={18} /> 나에게 보내기
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'violations' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="space-y-3">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">새 항목 추가</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newViolation}
                  onChange={(e) => setNewViolation(e.target.value)}
                  placeholder="항목명"
                  className="flex-1 bg-slate-100 border-none rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-pink-500/10 transition-all"
                />
                <button 
                  onClick={() => { if(newViolation){ setViolations([...violations, {id: Date.now().toString(), label: newViolation}]); setNewViolation(''); }}}
                  className="bg-slate-950 text-white px-8 rounded-2xl font-black text-sm"
                >
                  추가
                </button>
              </div>
            </div>
            <div className="grid gap-2">
              {violations.map(v => (
                <div key={v.id} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="font-black text-slate-700">{v.label}</span>
                  <button onClick={() => setViolations(violations.filter(x => x.id !== v.id))} className="text-slate-300 hover:text-red-500 transition-colors">
                    <Trash2 size={20} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'students' && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2">
             <div className="bg-slate-50 p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                <div className="flex items-center gap-3">
                  <div className="bg-pink-100 p-3 rounded-2xl text-pink-600">
                    <FileSpreadsheet size={24} />
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-slate-900">엑셀 일괄 등록</h4>
                    <p className="text-xs font-bold text-slate-400">학번 성명 순으로 붙여넣으세요.</p>
                  </div>
                </div>
                
                <textarea 
                  value={bulkText}
                  onChange={(e) => {
                    setBulkText(e.target.value);
                    handleBulkParse(e.target.value);
                  }}
                  placeholder="예시:&#13;10101 김석포&#13;10215 이여중"
                  className="w-full h-40 bg-white border border-slate-200 rounded-3xl p-6 text-sm font-mono focus:ring-4 focus:ring-pink-500/10 focus:outline-none transition-all resize-none"
                />

                {bulkPreview.length > 0 && (
                  <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                    <div className="max-h-40 overflow-y-auto bg-white border border-slate-100 rounded-2xl p-4 grid grid-cols-2 gap-2">
                      {bulkPreview.map((s, i) => (
                        <div key={i} className="text-[11px] font-bold text-slate-500 bg-slate-50 px-3 py-2 rounded-lg flex justify-between">
                          <span>{s.studentNumber}</span>
                          <span className="text-slate-900">{s.name}</span>
                        </div>
                      ))}
                    </div>
                    <button 
                      onClick={commitBulkUpload}
                      className="w-full bg-slate-950 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-pink-600 transition-all shadow-xl shadow-slate-900/10"
                    >
                      <ListPlus size={18} /> 학생 명단에 추가
                    </button>
                  </div>
                )}
             </div>

             <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                <p className="text-xs font-bold text-slate-400">현재 등록된 학생 <span className="text-pink-600 font-black">{students.length}명</span></p>
                <button 
                  onClick={clearAllStudents}
                  className="text-[11px] font-black text-red-400 hover:text-red-600 flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 size={14} /> 명단 전체 초기화
                </button>
             </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="animate-in fade-in slide-in-from-bottom-2">
            <AiInsights attendance={attendance} students={students} selectedDate={selectedDate} />
          </div>
        )}
      </div>

      <div className="bg-slate-50 px-8 py-4 border-t border-slate-100 flex items-center justify-between">
        <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase">석포여자중학교 지각관리시스템</span>
        <span className="text-[10px] font-black text-slate-300 flex items-center gap-1">Created by 김용섭 <Heart size={8} className="fill-slate-300" /></span>
      </div>
    </div>
  );
};

export default AdminPanel;
