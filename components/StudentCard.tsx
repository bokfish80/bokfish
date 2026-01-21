
import React, { useState } from 'react';
import { Student, AttendanceStatus, AttendanceEntry, ReflectionStatus, ViolationOption } from '../types';
import { STATUS_COLORS, STATUS_LABELS } from '../constants';
import { User, Clock, X, ShieldAlert, FileText, CheckCircle2, ChevronRight, Check, AlertCircle } from 'lucide-react';

interface StudentCardProps {
  student: Student;
  entry?: AttendanceEntry;
  violations: ViolationOption[];
  onStatusChange: (status: AttendanceStatus | null, options?: Partial<AttendanceEntry>) => void;
}

const StudentCard: React.FC<StudentCardProps> = ({ student, entry, violations, onStatusChange }) => {
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showViolationPicker, setShowViolationPicker] = useState(false);
  const [tempHour, setTempHour] = useState('08');
  const [tempMinute, setTempMinute] = useState('30');

  const status = entry?.type;

  const toggleReflection = (level: 1 | 2) => {
    if (!entry) return;
    const current = level === 1 ? entry.reflection1 : entry.reflection2;
    const next: ReflectionStatus = (!current || current === 'none') ? 'assigned' : (current === 'assigned' ? 'collected' : 'none');
    onStatusChange(entry.type, { ...entry, [level === 1 ? 'reflection1' : 'reflection2']: next });
  };

  return (
    <div className={`relative bg-white rounded-[2rem] border-2 p-5 transition-all duration-300 ${status ? 'border-pink-500/30 shadow-xl shadow-pink-500/5 bg-pink-50/10' : 'border-slate-100'}`}>
      <div className="flex items-center gap-4 mb-6">
        <div className={`w-14 h-14 rounded-[1.25rem] flex items-center justify-center transition-all ${status ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/20' : 'bg-slate-100 text-slate-300'}`}>
          <User size={28} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-black text-slate-900">{student.name}</h3>
            {status && (
              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-tight ${STATUS_COLORS[status]}`}>
                {STATUS_LABELS[status]}
              </span>
            )}
          </div>
          <p className="text-xs font-bold text-slate-400 mt-1">{student.studentNumber}</p>
        </div>
        {(status === 'late' || status === 'violation') && (
          <div className="text-[11px] font-black text-slate-950 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm">
            {status === 'late' ? entry?.time : entry?.violationType}
          </div>
        )}
      </div>

      {!showTimePicker && !showViolationPicker ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'late', icon: Clock, label: '지각', color: 'hover:bg-yellow-400 hover:text-white', active: 'bg-yellow-400 text-white shadow-lg shadow-yellow-200' },
              { id: 'absent', icon: X, label: '결석', color: 'hover:bg-red-500 hover:text-white', active: 'bg-red-500 text-white shadow-lg shadow-red-200' },
              { id: 'violation', icon: ShieldAlert, label: '위반', color: 'hover:bg-purple-600 hover:text-white', active: 'bg-purple-600 text-white shadow-lg shadow-purple-200' }
            ].map(btn => (
              <button 
                key={btn.id}
                onClick={() => {
                  if (status === btn.id) onStatusChange(null);
                  else if (btn.id === 'late') setShowTimePicker(true);
                  else if (btn.id === 'violation') setShowViolationPicker(true);
                  else onStatusChange('absent');
                }}
                className={`flex flex-col items-center justify-center gap-2 py-4 rounded-2xl border-2 border-slate-50 transition-all active:scale-95 ${status === btn.id ? btn.active : 'bg-slate-50 text-slate-400 ' + btn.color}`}
              >
                <btn.icon size={20} />
                <span className="text-[11px] font-black">{btn.label}</span>
              </button>
            ))}
          </div>

          {(status === 'late' || status === 'violation') && (
            <div className="flex gap-2 pt-2 border-t border-slate-100">
              {[1, 2].map(lvl => {
                const currentStatus = lvl === 1 ? entry?.reflection1 : entry?.reflection2;
                return (
                  <button 
                    key={lvl}
                    onClick={() => toggleReflection(lvl as 1|2)}
                    className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-xl border-2 transition-all ${
                      currentStatus === 'collected' ? 'bg-green-500 border-green-500 text-white shadow-lg shadow-green-200' :
                      currentStatus === 'assigned' ? 'bg-orange-400 border-orange-400 text-white animate-pulse-soft shadow-lg shadow-orange-200' :
                      'bg-white border-slate-100 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {currentStatus === 'collected' ? <CheckCircle2 size={12} /> : currentStatus === 'assigned' ? <AlertCircle size={12} /> : <Check size={12} />}
                      <span className="text-[10px] font-black">{lvl}차 성찰문</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : showTimePicker ? (
        <div className="bg-slate-950 p-4 rounded-3xl animate-in zoom-in-95">
          <div className="flex items-center justify-center gap-2 mb-4">
             <select value={tempHour} onChange={e => setTempHour(e.target.value)} className="bg-slate-800 border-none rounded-xl px-3 py-3 text-white font-black text-center flex-1">
                {Array.from({length:4},(_,i)=>i+7).map(h => <option key={h} value={h.toString().padStart(2,'0')}>{h}시</option>)}
             </select>
             <span className="text-white font-black">:</span>
             <select value={tempMinute} onChange={e => setTempMinute(e.target.value)} className="bg-slate-800 border-none rounded-xl px-3 py-3 text-white font-black text-center flex-1">
                {['00','10','20','30','40','50'].map(m => <option key={m} value={m}>{m}분</option>)}
             </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowTimePicker(false)} className="flex-1 py-3 text-xs font-black text-slate-400">취소</button>
            <button onClick={() => { onStatusChange('late', {time: `${tempHour}:${tempMinute}`}); setShowTimePicker(false); }} className="flex-1 bg-white py-3 rounded-xl text-xs font-black text-slate-950">입력</button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-950 p-4 rounded-3xl animate-in zoom-in-95 space-y-2">
          <div className="max-h-32 overflow-y-auto space-y-1 pr-1 scrollbar-hide">
            {violations.map(v => (
              <button 
                key={v.id} 
                onClick={() => { onStatusChange('violation', {violationType: v.label}); setShowViolationPicker(false); }}
                className="w-full text-left p-3 rounded-xl bg-slate-800 text-white text-[11px] font-black hover:bg-pink-600 transition-colors"
              >
                {v.label}
              </button>
            ))}
          </div>
          <button onClick={() => setShowViolationPicker(false)} className="w-full py-2 text-xs font-black text-slate-400">닫기</button>
        </div>
      )}
    </div>
  );
};

export default StudentCard;
