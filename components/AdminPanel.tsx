
import React, { useState } from 'react';
import { Student, ViolationOption, AttendanceState } from '../types';
import AiInsights from './AiInsights';
import { Settings, UserPlus, Trash2, ShieldCheck, X, Cloud, Share2, Copy, FileSpreadsheet, ListPlus, Sparkles, Heart } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'sync' | 'violations' | 'students' | 'ai'>('students');
  const [newViolation, setNewViolation] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [bulkPreview, setBulkPreview] = useState<Student[]>([]);

  const shareUrl = window.location.origin + window.location.pathname;

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
      alert('학생 등록이 완료되었습니다.');
    }
  };

  const clearAllStudents = () => {
    if (confirm('모든 학생 명단을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      setStudents([]);
    }
  };

  return (
    <div className="bg-white rounded-[3.5rem] shadow-3xl overflow-hidden flex flex-col h-full border border-slate-200 min-h-[600px]">
      <div className="bg-slate-950 px-10 py-8 flex items-center justify-between text-white shrink-0">
        <div className="flex items-center gap-4">
          <ShieldCheck className="text-pink-500 w-8 h-8" />
          <h2 className="text-2xl font-black tracking-tight uppercase tracking-widest">System Manager</h2>
        </div>
      </div>

      <div className="flex border-b border-slate-100 bg-slate-50/50 p-3 shrink-0 overflow-x-auto scrollbar-hide">
        {[
          { id: 'students', label: '명단 관리', icon: UserPlus },
          { id: 'violations', label: '교칙 설정', icon: Settings },
          { id: 'sync', label: '동기화/공유', icon: Cloud },
          { id: 'ai', label: 'AI 분석 리포트', icon: Sparkles }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 min-w-[100px] py-4 text-[12px] font-black rounded-3xl flex items-center justify-center gap-3 transition-all ${activeTab === tab.id ? 'bg-white text-pink-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-8 md:p-12 bg-white">
        {activeTab === 'sync' && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-3 duration-500">
            <div className="bg-gradient-to-br from-pink-600 to-indigo-700 p-10 rounded-[3rem] text-white space-y-8 shadow-2xl shadow-pink-500/30">
              <div className="space-y-3">
                <h4 className="text-3xl font-black tracking-tight">통합 동기화 주소</h4>
                <p className="text-pink-100 text-sm font-medium opacity-80">비밀번호 1111만 알면 누구나 이 시스템에 접속하여 데이터를 공유할 수 있습니다.</p>
              </div>
              <div className="bg-white/10 p-6 rounded-3xl break-all text-xs font-mono font-bold border border-white/20 backdrop-blur-md">
                {shareUrl}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => { navigator.clipboard.writeText(shareUrl); alert("주소가 복사되었습니다!"); }}
                  className="bg-white text-slate-900 py-5 rounded-2xl font-black text-sm flex items-center justify-center gap-3 hover:bg-pink-50 transition-colors"
                >
                  <Copy size={20} /> 주소 복사
                </button>
                <button 
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({ title: '석포여중 지각관리 동기화', url: shareUrl });
                    } else {
                      alert("공유 기능을 지원하지 않는 브라우저입니다.");
                    }
                  }}
                  className="bg-slate-950 text-white py-5 rounded-2xl font-black text-sm flex items-center justify-center gap-3 border border-white/10"
                >
                  <Share2 size={20} /> 다른 분께 공유
                </button>
              </div>
            </div>
            <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100">
              <h5 className="font-black text-slate-900 mb-4 flex items-center gap-2"><Heart size={16} className="text-pink-500" /> 동기화 도움말</h5>
              <p className="text-sm text-slate-500 font-medium leading-relaxed italic">"지금 바로 연동" 버튼을 누르면 입력한 내용이 즉시 클라우드에 저장되어 동료 선생님의 화면에도 나타납니다. 암호 1111이 같아야만 동일한 정보를 공유하게 됩니다.</p>
            </div>
          </div>
        )}

        {activeTab === 'violations' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-500">
            <div className="space-y-4">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-2">새 위반 항목 추가</label>
              <div className="flex gap-3">
                <input 
                  type="text" 
                  value={newViolation}
                  onChange={(e) => setNewViolation(e.target.value)}
                  placeholder="예: 실내화 미착용"
                  className="flex-1 bg-slate-100 border-none rounded-2xl px-6 py-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-pink-500/10 transition-all"
                />
                <button 
                  onClick={() => { if(newViolation){ setViolations([...violations, {id: Date.now().toString(), label: newViolation}]); setNewViolation(''); }}}
                  className="bg-slate-950 text-white px-10 rounded-2xl font-black text-sm active:scale-95 transition-all"
                >
                  추가하기
                </button>
              </div>
            </div>
            <div className="grid gap-3">
              {violations.map(v => (
                <div key={v.id} className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100 group hover:border-pink-200 transition-all">
                  <span className="font-black text-slate-700">{v.label}</span>
                  <button onClick={() => setViolations(violations.filter(x => x.id !== v.id))} className="text-slate-300 hover:text-red-500 transition-colors">
                    <Trash2 size={22} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'students' && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-3 duration-500">
             <div className="bg-slate-50 p-8 md:p-12 rounded-[3.5rem] border border-slate-200 shadow-inner space-y-8">
                <div className="flex items-center gap-5">
                  <div className="bg-pink-100 p-5 rounded-3xl text-pink-600 shadow-lg">
                    <FileSpreadsheet size={32} />
                  </div>
                  <div>
                    <h4 className="text-2xl font-black text-slate-900">엑셀/한글 일괄 등록</h4>
                    <p className="text-sm font-bold text-slate-400 mt-1">학번과 이름을 복사해서 아래에 붙여넣으세요.</p>
                  </div>
                </div>
                
                <textarea 
                  value={bulkText}
                  onChange={(e) => {
                    setBulkText(e.target.value);
                    handleBulkParse(e.target.value);
                  }}
                  placeholder="예시)&#13;10101 김석포&#13;10215 이여중"
                  className="w-full h-56 bg-white border border-slate-200 rounded-[2rem] p-8 text-sm font-mono focus:ring-4 focus:ring-pink-500/10 focus:outline-none transition-all resize-none shadow-sm"
                />

                {bulkPreview.length > 0 && (
                  <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                    <div className="max-h-56 overflow-y-auto bg-white border border-slate-100 rounded-[2rem] p-6 grid grid-cols-2 sm:grid-cols-3 gap-3 shadow-sm">
                      {bulkPreview.map((s, i) => (
                        <div key={i} className="text-[12px] font-bold text-slate-500 bg-slate-50 px-4 py-3 rounded-xl flex justify-between items-center">
                          <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded">{s.studentNumber}</span>
                          <span className="text-slate-900">{s.name}</span>
                        </div>
                      ))}
                    </div>
                    <button 
                      onClick={commitBulkUpload}
                      className="w-full bg-slate-950 text-white py-6 rounded-[1.5rem] font-black flex items-center justify-center gap-3 hover:bg-pink-600 transition-all shadow-2xl shadow-slate-900/10 active:scale-95"
                    >
                      <ListPlus size={22} /> 위 학생들을 명단에 최종 추가
                    </button>
                  </div>
                )}
             </div>

             <div className="flex flex-col md:flex-row items-center justify-between p-8 bg-slate-50 rounded-[2rem] border border-slate-100 gap-4">
                <p className="text-sm font-black text-slate-500">현재 등록된 학생 수: <span className="text-pink-600 text-xl ml-1">{students.length}명</span></p>
                <button 
                  onClick={clearAllStudents}
                  className="text-xs font-black text-red-400 hover:text-red-600 flex items-center gap-2 transition-colors px-4 py-2 hover:bg-red-50 rounded-xl"
                >
                  <Trash2 size={16} /> 명단 전체 초기화 (주의!)
                </button>
             </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-500">
            <AiInsights attendance={attendance} students={students} selectedDate={selectedDate} />
          </div>
        )}
      </div>

      <div className="bg-slate-50 px-12 py-6 border-t border-slate-100 flex items-center justify-between">
        <span className="text-[11px] font-black text-slate-400 tracking-widest uppercase">석포여자중학교 지각관리시스템</span>
        <span className="text-[11px] font-black text-slate-300 flex items-center gap-2">Created with passion <Heart size={10} className="fill-slate-300" /></span>
      </div>
    </div>
  );
};

export default AdminPanel;
