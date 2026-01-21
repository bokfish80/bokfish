
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { generateInitialStudents, DEFAULT_VIOLATIONS } from './constants';
import { AttendanceState, AttendanceStatus, AttendanceEntry, Student, ViolationOption } from './types';
import StudentCard from './components/StudentCard';
import StatsDashboard from './components/StatsDashboard';
import AdminPanel from './components/AdminPanel';
import { UserCheck, Wifi, RefreshCw, Save, Unlock, Calendar, Search, LayoutGrid, TrendingUp, ShieldCheck, Lock, ArrowRight, ChevronLeft, GraduationCap, Users, Info } from 'lucide-react';

/* ===================== 공통 유틸 ===================== */

const getLocalDate = () => new Date().toLocaleDateString('en-CA');

const getDeviceId = () => {
  let id = localStorage.getItem('seokpo_device_id');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('seokpo_device_id', id);
  }
  return id;
};

const DEVICE_ID = getDeviceId();
const BUCKET_ID = 'AnV9v8pB3vB6g7r9q8zX1';
const BASE_KEY = 'seokpo_v11_sync';

/* ===================== 타입 ===================== */

interface SyncPayload {
  attendance: AttendanceState;
  students: Student[];
  violations: ViolationOption[];
  timestamp: number;
  updatedBy: string;
}

const App: React.FC = () => {
  const STORAGE = 'sg_v11_';

  const [auth, setAuth] = useState(localStorage.getItem(STORAGE + 'auth') || '');
  const [ready, setReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'connected' | 'error'>('idle');

  const [selectedDate, setSelectedDate] = useState(getLocalDate());
  const [activeTab, setActiveTab] = useState<'list' | 'stats' | 'admin'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [currentYear, setCurrentYear] = useState<number | null>(null);
  const [currentClass, setCurrentClass] = useState<number | null>(null);

  const [attendance, setAttendance] = useState<AttendanceState>({});
  const [students, setStudents] = useState<Student[]>([]);
  const [violations, setViolations] = useState<ViolationOption[]>(DEFAULT_VIOLATIONS);

  const lastServerTimestamp = useRef(0);
  const isPushing = useRef(false);
  const isDirty = useRef(false);

  const syncKey = useMemo(
    () => (auth === '1111' ? `${BASE_KEY}_${auth}` : ''),
    [auth]
  );

  /* ===================== 동기화 ===================== */

  const pull = useCallback(async () => {
    if (!syncKey || isPushing.current) return;

    setSyncStatus('syncing');
    try {
      const res = await fetch(`https://kvdb.io/${BUCKET_ID}/${syncKey}`);
      if (!res.ok) {
        setSyncStatus('connected');
        return;
      }

      const text = await res.text();
      if (!text || text === "null") {
        setSyncStatus('connected');
        return;
      }

      const remote: SyncPayload = JSON.parse(text);
      if (!remote?.timestamp) return;

      if (remote.timestamp <= lastServerTimestamp.current) {
        setSyncStatus('connected');
        return;
      }
      
      if (remote.updatedBy === DEVICE_ID) {
        lastServerTimestamp.current = remote.timestamp;
        setSyncStatus('connected');
        return;
      }

      setAttendance(remote.attendance || {});
      setStudents(remote.students || []);
      setViolations(remote.violations || DEFAULT_VIOLATIONS);

      lastServerTimestamp.current = remote.timestamp;
      isDirty.current = false;
      setSyncStatus('connected');
    } catch {
      setSyncStatus('error');
    }
  }, [syncKey]);

  const push = useCallback(async () => {
    if (!syncKey || !isDirty.current || isPushing.current) return;

    isPushing.current = true;
    setSyncStatus('syncing');

    const payload: SyncPayload = {
      attendance,
      students,
      violations,
      timestamp: Date.now(),
      updatedBy: DEVICE_ID,
    };

    try {
      await fetch(`https://kvdb.io/${BUCKET_ID}/${syncKey}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      });

      lastServerTimestamp.current = payload.timestamp;
      isDirty.current = false;
      setSyncStatus('connected');
    } catch {
      setSyncStatus('error');
    } finally {
      isPushing.current = false;
    }
  }, [attendance, students, violations, syncKey]);

  /* ===================== 초기화 ===================== */

  useEffect(() => {
    if (auth !== '1111') return;

    const local = localStorage.getItem(STORAGE + 'data');
    if (local) {
      const parsed: SyncPayload = JSON.parse(local);
      setAttendance(parsed.attendance || {});
      setStudents(parsed.students || generateInitialStudents());
      setViolations(parsed.violations || DEFAULT_VIOLATIONS);
      lastServerTimestamp.current = parsed.timestamp || 0;
    } else {
      setStudents(generateInitialStudents());
    }

    pull().finally(() => setReady(true));
  }, [auth, pull]);

  useEffect(() => {
    if (!ready) return;

    const timer = setInterval(pull, 5000);
    return () => clearInterval(timer);
  }, [ready, pull]);

  useEffect(() => {
    if (!ready) return;

    isDirty.current = true;
    localStorage.setItem(
      STORAGE + 'data',
      JSON.stringify({
        attendance,
        students,
        violations,
        timestamp: lastServerTimestamp.current,
        updatedBy: DEVICE_ID,
      })
    );

    const t = setTimeout(push, 2000);
    return () => clearTimeout(t);
  }, [attendance, students, violations, ready, push]);

  /* ===================== 출결 업데이트 ===================== */

  const updateStatus = (status: AttendanceStatus | null, studentId: string, options?: Partial<AttendanceEntry>) => {
    setAttendance(prev => {
      const day = { ...(prev[selectedDate] || {}) };
      if (status === null) delete day[studentId];
      else day[studentId] = { type: status, ...options } as AttendanceEntry;
      return { ...prev, [selectedDate]: day };
    });
  };

  /* ===================== 통계 집계 ===================== */

  const currentDayStats = useMemo(() => {
    const dayRecords = attendance[selectedDate] || {};
    const records = Object.values(dayRecords);
    const late = records.filter(r => r.type === 'late').length;
    const absent = records.filter(r => r.type === 'absent').length;
    const total = students.length;
    return { late, absent, normal: total - (late + absent), total };
  }, [attendance, selectedDate, students]);

  /* ===================== 로그인 UI ===================== */

  if (auth !== '1111') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full space-y-10 animate-in fade-in zoom-in duration-700">
          <div className="bg-pink-600/20 w-24 h-24 rounded-[2.5rem] flex items-center justify-center text-white mx-auto shadow-2xl backdrop-blur-xl border border-pink-500/30">
            <Lock size={48} className="text-pink-500" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight leading-tight">석포여자중학교<br/><span className="text-pink-500">지각관리시스템</span></h1>
          </div>
          <div className="bg-slate-900/50 p-10 rounded-[3rem] border border-white/5 space-y-8 shadow-3xl">
            <input 
              autoFocus
              type="password" 
              inputMode="numeric"
              maxLength={4}
              placeholder="••••"
              className="w-full bg-slate-800/50 border-none rounded-3xl px-6 py-6 text-4xl font-black text-pink-500 placeholder:text-slate-700 focus:ring-4 focus:ring-pink-500/20 transition-all text-center tracking-[1em]"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = e.currentTarget.value;
                  if (val === '1111') {
                    localStorage.setItem(STORAGE + 'auth', '1111');
                    setAuth('1111');
                  } else {
                    alert('암호가 틀립니다.');
                  }
                }
              }}
            />
            <button 
              onClick={() => {
                const input = document.querySelector('input') as HTMLInputElement;
                if (input.value === '1111') {
                  localStorage.setItem(STORAGE + 'auth', '1111');
                  setAuth('1111');
                } else {
                  alert('암호가 틀립니다.');
                }
              }}
              className="w-full bg-white text-slate-950 py-5 rounded-2xl font-black text-lg hover:bg-pink-500 hover:text-white transition-all active:scale-95 shadow-xl flex items-center justify-center gap-2 group"
            >
              시스템 접속 <ArrowRight className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <RefreshCw size={48} className="text-pink-500 animate-spin mb-6" />
        <h2 className="text-2xl font-black text-white">데이터 동기화 중...</h2>
      </div>
    );
  }

  /* ===================== UI 필터링 ===================== */

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.includes(searchQuery) || s.studentNumber.includes(searchQuery);
    if (searchQuery) return matchesSearch;
    return (currentYear === null || s.year === currentYear) && (currentClass === null || s.classGroup === currentClass);
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      <header className="glass sticky top-0 z-40 border-b border-slate-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer" onClick={() => {setCurrentYear(null); setCurrentClass(null); setActiveTab('list');}}>
            <div className="bg-slate-950 p-3 rounded-2xl text-white shadow-xl">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">석포여중 지각관리</h1>
              <div className="flex items-center gap-2 mt-1.5">
                 <span className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-tighter ${syncStatus === 'error' ? 'text-red-500' : 'text-slate-400'}`}>
                   {syncStatus === 'syncing' ? <RefreshCw size={10} className="animate-spin" /> : <Wifi size={10} />}
                   {syncStatus === 'error' ? '연결 오류' : '동기화 활성'}
                 </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => push()} className={`p-3.5 rounded-2xl transition-all shadow-sm ${isDirty.current ? 'bg-pink-600 text-white' : 'bg-white border border-slate-200 text-slate-400'}`} title="지금 저장">
              <Save size={18} />
            </button>
            <button onClick={() => { if(confirm('로그아웃 하시겠습니까?')){ localStorage.clear(); location.reload(); } }} className="bg-slate-950 text-white p-3.5 rounded-2xl hover:bg-slate-800 transition-all shadow-sm">
              <Unlock size={18} />
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 md:px-8 py-3.5 flex flex-col md:flex-row gap-3">
          <div className="relative flex items-center bg-white rounded-2xl px-5 py-3 border border-slate-200 shadow-sm">
            <Calendar size={18} className="text-pink-500 mr-3 shrink-0" />
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-transparent text-sm font-black focus:outline-none text-slate-700 w-full" />
          </div>
          <div className="relative flex-1">
            <Search size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="학생 검색 (이름/학번)" className="w-full bg-white border border-slate-200 rounded-2xl pl-14 pr-6 py-3 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-pink-500/10 transition-all shadow-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 md:px-8 flex gap-8">
          {[
            { id: 'list', label: '학생 현황', icon: LayoutGrid },
            { id: 'stats', label: '데이터 분석', icon: TrendingUp },
            { id: 'admin', label: '관리자 설정', icon: ShieldCheck }
          ].map((tab) => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id as any)} 
              className={`pb-4 pt-2 text-sm font-black transition-all flex items-center gap-2 border-b-4 ${activeTab === tab.id ? 'border-pink-600 text-pink-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              <tab.icon size={18} /> {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* 오늘의 현황 요약 바 (학생 현황 탭일 때만 표시) */}
      {activeTab === 'list' && (
        <div className="bg-slate-900 text-white border-b border-white/5">
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 text-slate-500 text-[10px] font-black uppercase tracking-widest mr-2">
                <Info size={14} /> 오늘의 현황
              </div>
              <div className="flex gap-2.5">
                <div className="bg-yellow-400 text-slate-950 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-lg shadow-yellow-400/10">
                  <span className="text-[10px] font-black opacity-60 uppercase">지각</span>
                  <span className="text-xs font-black">{currentDayStats.late}</span>
                </div>
                <div className="bg-red-500 text-white px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-lg shadow-red-500/10">
                  <span className="text-[10px] font-black opacity-60 uppercase">결석</span>
                  <span className="text-xs font-black">{currentDayStats.absent}</span>
                </div>
                <div className="bg-white/10 text-white px-3 py-1.5 rounded-xl flex items-center gap-2 border border-white/10">
                  <span className="text-[10px] font-black opacity-40 uppercase">정상</span>
                  <span className="text-xs font-black">{currentDayStats.normal}</span>
                </div>
              </div>
            </div>
            <div className="text-[10px] font-black text-slate-500 hidden md:block">
              전체 {currentDayStats.total}명 기준 집계
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl mx-auto px-4 md:px-8 py-8 w-full">
        {activeTab === 'list' && (
          <div className="space-y-8">
            {/* 검색어가 없고 학년이 선택되지 않았을 때: 학년 선택 화면 */}
            {!searchQuery && currentYear === null && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-5">
                {[1, 2, 3].map(year => (
                  <button key={year} onClick={() => setCurrentYear(year)} className="group bg-white border border-slate-200 p-12 rounded-[3rem] transition-all hover:shadow-2xl hover:border-pink-500/50 flex flex-col items-center">
                    <div className="bg-slate-50 p-8 rounded-[2rem] text-slate-300 group-hover:bg-pink-500 group-hover:text-white transition-all mb-6">
                      <GraduationCap className="w-12 h-12" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 group-hover:text-pink-600">{year}학년</h3>
                    <p className="text-sm font-bold text-slate-400 mt-2">학년을 선택하여 반 목록을 확인하세요</p>
                  </button>
                ))}
              </div>
            )}

            {/* 검색어가 없고 학년은 선택되었으나 반이 선택되지 않았을 때: 반 선택 화면 */}
            {!searchQuery && currentYear !== null && currentClass === null && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-5">
                <div className="flex items-center justify-between">
                  <button onClick={() => setCurrentYear(null)} className="flex items-center gap-2 text-slate-500 font-black hover:text-pink-600 transition-colors">
                    <ChevronLeft size={20} /> 학년 선택으로
                  </button>
                  <h2 className="text-2xl font-black text-slate-900">{currentYear}학년 반 선택</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map(cls => (
                    <button key={cls} onClick={() => setCurrentClass(cls)} className="bg-white border border-slate-200 p-10 rounded-3xl hover:border-pink-500 hover:shadow-xl transition-all flex flex-col items-center gap-2 group">
                      <Users className="w-6 h-6 text-slate-200 group-hover:text-pink-500 transition-colors" />
                      <span className="font-black text-2xl text-slate-900">{cls}반</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 학생 목록 표시 (검색 중이거나 학년/반이 모두 선택되었을 때) */}
            {(searchQuery || (currentYear !== null && currentClass !== null)) && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-5">
                {!searchQuery && (
                  <div className="flex items-center justify-between">
                    <button onClick={() => setCurrentClass(null)} className="flex items-center gap-2 text-slate-500 font-black hover:text-pink-600 transition-colors">
                      <ChevronLeft size={20} /> 반 선택으로
                    </button>
                    <div className="flex items-center gap-2 bg-pink-50 text-pink-600 px-4 py-2 rounded-2xl font-black text-sm border border-pink-100">
                      {currentYear}학년 {currentClass}반
                    </div>
                  </div>
                )}
                {searchQuery && (
                  <div className="flex items-center gap-2 text-slate-400 font-bold mb-4">
                    <Search size={16} /> '{searchQuery}' 검색 결과 ({filteredStudents.length}명)
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map(s => (
                      <StudentCard
                        key={s.id}
                        student={s}
                        entry={attendance[selectedDate]?.[s.id]}
                        violations={violations}
                        onStatusChange={(st, opt) => updateStatus(st, s.id, opt)}
                      />
                    ))
                  ) : (
                    <div className="col-span-full py-32 text-center text-slate-300">
                       <Search size={48} className="mx-auto mb-4 opacity-10" />
                       <p className="font-bold">해당 조건에 맞는 학생이 없습니다.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'stats' && <StatsDashboard attendance={attendance} students={students} />}
        
        {activeTab === 'admin' && (
          <AdminPanel
            students={students}
            setStudents={setStudents}
            violations={violations}
            setViolations={setViolations}
            attendance={attendance}
            selectedDate={selectedDate}
            syncKey={syncKey}
            onClose={() => setActiveTab('list')}
          />
        )}
      </main>

      <footer className="py-10 text-center border-t border-slate-100 bg-white">
        <div className="flex items-center justify-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest">
          <span>석포여중 지각관리시스템 v11.0</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
