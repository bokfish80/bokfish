
import React, { useState } from 'react';
import { Student, ViolationOption, AttendanceState } from '../types';
import AiInsights from './AiInsights';
import { Settings, UserPlus, Trash2, ShieldCheck, X, Cloud, Share2, Copy, FileSpreadsheet, ListPlus, Sparkles, User, Plus } from 'lucide-react';

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

  // 개별 등록 상태
  const [singleStudent, setSingleStudent] = useState({
    year: '1',
    classGroup: '1',
    number: '',
    name: ''
  });

  const shareUrl = window.location.origin + window.location.pathname;

  const handleBulkParse = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    const newStudents: Student[] = lines.map((line) => {
      const parts = line.split(/[\s,\t]+/).filter(p => p.trim() !== '');
      if (parts.length < 2) return null;
      
      const number = parts[0];
      const name = parts[1];
      
      const year = parseInt(number[0]);
      const classGroup = parseInt(number[1]);

      return {
        id: `std-${number}-${Date.now()}`,
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

  const handleAddSingleStudent = () => {
    const { year, classGroup, number, name } = singleStudent;
    if (!number || !name) {
      alert('학번과 이름을 모두 입력해주세요.');
      return;
    }

    const fullStudentNumber = `${year}${classGroup}${number.padStart(2, '0')}`;
    
    // 중복 체크
    if (students.some(s => s.studentNumber === fullStudentNumber)) {
      alert('이미 존재하는 학번입니다.');
      return;
    }

    const newStd: Student = {
      id: `std-${fullStudentNumber}-${Date.now()}`,
      name: name,
      studentNumber: fullStudentNumber,
      year: parseInt(year),
      classGroup: parseInt(classGroup)
    };

    setStudents([...students, newStd]);
    setSingleStudent({ ...singleStudent, number: '', name: '' });
    alert(`${name} 학생이 등록되었습니다.`);
  };

  return (
    <div className="bg-white rounded-[3rem] shadow-3xl overflow-hidden flex flex-col h-full border border-slate-200 min-h-[600px] animate-in slide-in-from-bottom-5">
      <div className="bg-slate-950 px-8 py-6 flex items-center justify-between text-white shrink-0">
        <div className="flex items-center gap-4">
          <ShieldCheck className="text-pink-500 w-8 h-8" />
          <h2 className="text-xl font-black tracking-tight uppercase">관리자 설정</h2>
        </div>
        <button onClick={onClose} className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all">
          <X size={20} />
        </button>
      </div>

      <div className="flex border-b border-slate-100 bg-slate-50/50 p-2 shrink-0 overflow-x-auto scrollbar-hide">
        {[
          { id: 'students', label: '명단 관리', icon: UserPlus },
          { id: 'violations', label: '교칙 설정', icon: Settings },
          { id: 'sync', label: '동기화/공유', icon: Cloud },
          { id: 'ai', label: 'AI 분석', icon: Sparkles }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 min-w-[90px] py-3 text-[12px] font-black rounded-2xl flex items-center justify-center gap-2 transition-all ${activeTab === tab.id ? 'bg-white text-pink-600 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        {activeTab === 'sync' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-pink-600 to-indigo-700 p-8 rounded-[2.5rem] text-white space-y-6">
              <h4 className="text-xl font-black">실시간 동기화 주소</h4>
              <div className="bg-white/10 p-4 rounded-2xl break-all text-[10px] font-mono border border-white/20">
                {shareUrl}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => { navigator.clipboard.writeText(shareUrl); alert("복사되었습니다!"); }} className="bg-white text-slate-900 py-4 rounded-xl font-black text-xs flex items-center justify-center gap-2"><Copy size={16} /> 주소 복사</button>
                <button onClick={() => navigator.share && navigator.share({title: '석포여중 지각관리', url: shareUrl})} className="bg-slate-950 text-white py-4 rounded-xl font-black text-xs flex items-center justify-center gap-2"><Share2 size={16} /> 공유하기</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'violations' && (
          <div className="space-y-6">
            <div className="flex gap-2">
              <input type="text" value={newViolation} onChange={(e) => setNewViolation(e.target.value)} placeholder="새 위반 항목..." className="flex-1 bg-slate-100 border-none rounded-2xl px-5 py-4 text-sm font-bold" />
              <button onClick={() => { if(newViolation){ setViolations([...violations, {id: Date.now().toString(), label: newViolation}]); setNewViolation(''); }}} className="bg-slate-950 text-white px-6 rounded-2xl font-black text-xs">추가</button>
            </div>
            <div className="grid gap-2">
              {violations.map(v => (
                <div key={v.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="font-bold text-slate-700 text-sm">{v.label}</span>
                  <button onClick={() => setViolations(violations.filter(x => x.id !== v.id))} className="text-slate-300 hover:text-red-500"><Trash2 size={18} /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'students' && (
          <div className="space-y-8 pb-10">
             {/* 학생 개별 등록 */}
             <div className="bg-white border-2 border-slate-100 p-6 rounded-[2rem] space-y-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <User size={24} className="text-pink-500" />
                  <h4 className="font-black text-slate-900">학생 개별 등록</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">학년</label>
                    <select value={singleStudent.year} onChange={e => setSingleStudent({...singleStudent, year: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold">
                      <option value="1">1학년</option>
                      <option value="2">2학년</option>
                      <option value="3">3학년</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">반</label>
                    <select value={singleStudent.classGroup} onChange={e => setSingleStudent({...singleStudent, classGroup: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold">
                      <option value="1">1반</option>
                      <option value="2">2반</option>
                      <option value="3">3반</option>
                      <option value="4">4반</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">번호</label>
                    <input type="number" placeholder="번호" value={singleStudent.number} onChange={e => setSingleStudent({...singleStudent, number: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">이름</label>
                    <input type="text" placeholder="이름" value={singleStudent.name} onChange={e => setSingleStudent({...singleStudent, name: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold" />
                  </div>
                </div>
                <button onClick={handleAddSingleStudent} className="w-full bg-pink-600 text-white py-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-xl hover:bg-pink-700 transition-colors">
                  <Plus size={18} /> 학생 추가하기
                </button>
             </div>

             {/* 학생 일괄 등록 */}
             <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200 space-y-4">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet size={24} className="text-pink-500" />
                  <h4 className="font-black text-slate-900">명단 일괄 등록</h4>
                </div>
                <textarea 
                  value={bulkText} 
                  onChange={(e) => { setBulkText(e.target.value); handleBulkParse(e.target.value); }} 
                  placeholder="학번 이름 (엔터로 구분)&#13;10101 홍길동&#13;10102 김철수" 
                  className="w-full h-40 bg-white border border-slate-200 rounded-2xl p-4 text-sm font-mono focus:outline-none" 
                />
                {bulkPreview.length > 0 && (
                  <button onClick={commitBulkUpload} className="w-full bg-slate-950 text-white py-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-xl"><ListPlus size={18} /> {bulkPreview.length}명 한꺼번에 추가</button>
                )}
             </div>
             
             <div className="pt-6 border-t border-slate-100 flex flex-col gap-3">
               <p className="text-[10px] font-bold text-slate-400 text-center">현재 등록된 학생 수: {students.length}명</p>
               <button onClick={() => { if(confirm('전체 명단을 삭제하시겠습니까?')){ setStudents([]); } }} className="w-full text-xs font-black text-red-400 py-3 border border-red-100 rounded-xl hover:bg-red-50 transition-colors">명단 전체 초기화</button>
             </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <AiInsights attendance={attendance} students={students} selectedDate={selectedDate} />
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
