
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { generateInitialStudents, DEFAULT_VIOLATIONS } from './constants';
import { AttendanceState, AttendanceStatus, AttendanceEntry, Student, ViolationOption } from './types';
import StudentCard from './components/StudentCard';
import StatsDashboard from './components/StatsDashboard';
import AdminPanel from './components/AdminPanel';
import { UserCheck, Wifi, RefreshCw, Save, Unlock, Calendar, Search, LayoutGrid, TrendingUp, ShieldCheck, Lock, ArrowRight, ChevronLeft, GraduationCap, Users, Info, Clock } from 'lucide-react';

// Firebase SDK Imports
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set } from 'firebase/database';

/* ===================== Firebase 설정 ===================== */

const FIREBASE_CONFIG = {
  apiKey: "YAIzaSyDO9G1oy59a1aY1sMDoML3kVKSu9moaj0w",
  authDomain: "bokfish-late.firebaseapp.com",
  databaseURL: "https://bokfish-late-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "bokfish-late",
  storageBucket: "bokfish-late.firebasestorage.app",
  messagingSenderId: "1071759128179",
  appId: "1:1071759128179:web:1cc1056250a08bf8eedc06"
};

const getDeviceId = () => {
  let id = localStorage.getItem('seokpo_device_id');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('seokpo_device_id', id);
  }
  return id;
};

const DEVICE_ID = getDeviceId();
const getLocalDate = () => new Date().toLocaleDateString('en-CA');

/* ===================== 타입 ===================== */

interface SyncPayload {
  attendance: AttendanceState;
  students: Student[];
  violations: ViolationOption[];
  timestamp: number;
  updatedBy: string;
}

const App: React.FC = () => {
  const STORAGE = 'sg_fb_v1_';

  const [auth, setAuth] = useState(localStorage.getItem(STORAGE + 'auth') || '');
  const [ready, setReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'connected' | 'error'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<string>('-');

  const [selectedDate, setSelectedDate] = useState(getLocalDate());
  const [activeTab, setActiveTab] = useState<'list' | 'stats' | 'admin'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [currentYear, setCurrentYear] = useState<number | null>(null);
  const [currentClass, setCurrentClass] = useState<number | null>(null);
  
  // 상태 필터링을 위한 state 추가
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | 'normal' | null>(null);

  const [attendance, setAttendance] = useState<AttendanceState>({});
  const [students, setStudents] = useState<Student[]>([]);
  const [violations, setViolations] = useState<ViolationOption[]>(DEFAULT_VIOLATIONS);

  const lastServerTimestamp = useRef(0);
  const isLocalChange = useRef(false);

  // Firebase Ref
  const db = useMemo(() => {
    if (auth === '1111') {
      try {
        const app = initializeApp(FIREBASE_CONFIG);
        return getDatabase(app);
      } catch (e) {
        console.error("Firebase Init Error", e);
        return null;
      }
    }
    return null;
  }, [auth]);

  const dataRef = useMemo(() => db ? ref(db, 'seokpo_data') : null, [db]);

  /* ===================== Firebase 실시간 동기화 로직 ===================== */

  useEffect(() => {
    if (!dataRef || !auth) return;

    setSyncStatus('syncing');
    const unsubscribe = onValue(dataRef, (snapshot) => {
      const data = snapshot.val() as SyncPayload;
      if (data) {
        if (data.timestamp > lastServerTimestamp.current && data.updatedBy !== DEVICE_ID) {
          isLocalChange.current = false;
          setAttendance(data.attendance || {});
          setStudents(data.students || []);
          setViolations(data.violations || DEFAULT_VIOLATIONS);
          lastServerTimestamp.current = data.timestamp;
        }
      } else if (!ready) {
        setStudents(generateInitialStudents());
        isLocalChange.current = true;
      }
      
      setLastSyncTime(new Date().toLocaleTimeString('ko-KR', { hour12: false }));
      setSyncStatus('connected');
      if (!ready) setReady(true);
    }, (error) => {
      console.error(error);
      setSyncStatus('error');
    });

    return () => unsubscribe();
  }, [dataRef, auth, ready]);

  const pushToFirebase = useCallback(async (force = false) => {
    if (!dataRef || !ready || (!isLocalChange.current && !force)) return;

    setSyncStatus('syncing');
    const newTimestamp = Date.now();
    const payload: SyncPayload = {
      attendance,
      students,
      violations,
      timestamp: newTimestamp,
      updatedBy: DEVICE_ID,
    };

    try {
      await set(dataRef, payload);
      lastServerTimestamp.current = newTimestamp;
      isLocalChange.current = false;
      setSyncStatus('connected');
      setLastSyncTime(new Date().toLocaleTimeString('ko-KR', { hour12: false }));
    } catch (e) {
      console.error(e);
      setSyncStatus('error');
    }
  }, [attendance, students, violations, dataRef, ready]);

  useEffect(() => {
    if (!ready || !isLocalChange.current) return;
    const t = setTimeout(() => { pushToFirebase(); }, 1000);
    return () => clearTimeout(t);
  }, [attendance, students, violations, ready, pushToFirebase]);

  /* ===================== 출결 업데이트 ===================== */

  const updateStatus = (status: AttendanceStatus | null, studentId: string, options?: Partial<AttendanceEntry>) => {
    isLocalChange.current = true;
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
    const records = Object.values(dayRecords) as AttendanceEntry[];
    const late = records.filter(r => r.type === 'late').length;
    const absent = records.filter(r => r.type === 'absent').length;
    const total = students.length;
    return { late, absent, normal: total - (late + absent), total };
  }, [attendance, selectedDate, students]);

  /* ===================== 필터링 로직 ===================== */

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const entry = attendance[selectedDate]?.[s.id];
      const sStatus = entry?.type || 'normal';

      // 1. 상태 필터링 체크
      const matchesStatus = statusFilter === null || sStatus === statusFilter;
      if (!matchesStatus) return false;

      // 2. 검색어 체크
      const matchesSearch = s.name.includes(searchQuery) || s.studentNumber.includes(searchQuery);
      if (searchQuery) return matchesSearch;

      // 3. 학년/반 체크
      const matchesYear = currentYear === null || s.year === currentYear;
      const matchesClass = currentClass === null || s.classGroup === currentClass;
      
      return matchesYear && matchesClass;
    });
  }, [students, attendance, selectedDate, statusFilter, searchQuery, currentYear, currentClass]);

  // 필터 초기화 유틸
  const resetFilters = () => {
    setCurrentYear(null);
    setCurrentClass(null);
    setStatusFilter(null);
    setSearchQuery('');
  };

  /* ===================== UI 렌더링 ===================== */

  if (auth !== '1111') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full space-y-10 animate-in fade-in zoom-in duration-700">
          <div className="bg-pink-600/20 w-24 h-24 rounded-[2.5rem] flex items-center justify-center text-white mx-auto shadow-2xl backdrop-blur-xl border border-pink-500/30">
            <Lock size={48} className="text-pink-500" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight whitespace-nowrap">석포여중 <span className="text-pink-500">지각관리시스템</span></h1>
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

  if (!ready && auth === '1111') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <RefreshCw size={48} className="text-pink-500 animate-spin mb-6" />
        <h2 className="text-2xl font-black text-white">데이터 동기화 중...</h2>
        <p className="text-slate-500 text-sm mt-2">Firebase 실시간 엔진에 연결하고 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      <header className="glass sticky top-0 z-40 border-b border-slate-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 cursor-pointer overflow-hidden" onClick={resetFilters}>
            <div className="bg-slate-950 p-2 sm:p-3 rounded-xl sm:rounded-2xl text-white shadow-xl shrink-0">
              <UserCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-none whitespace-nowrap overflow-hidden text-ellipsis">석포여중 지각관리시스템</h1>
              <div className="flex items-center gap-1 mt-1 sm:mt-1.5 overflow-hidden">
                 <span className={`flex items-center gap-1 text-[9px] sm:text-[10px] font-black uppercase tracking-tighter whitespace-nowrap ${syncStatus === 'error' ? 'text-red-500' : 'text-slate-400'}`}>
                   {syncStatus === 'syncing' ? <RefreshCw size={9} className="animate-spin" /> : <Wifi size={9} />}
                   {syncStatus === 'error' ? '오류' : `실시간 보호 (${lastSyncTime})`}
                 </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button 
              onClick={() => pushToFirebase(true)} 
              disabled={syncStatus === 'syncing'}
              className={`flex items-center gap-2 px-3 sm:px-5 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-xs transition-all shadow-sm ${syncStatus === 'syncing' ? 'bg-slate-100 text-slate-400' : 'bg-pink-600 text-white hover:bg-pink-700 active:scale-95'}`}
            >
              <RefreshCw size={14} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">수동 동기화</span>
            </button>
            <button onClick={() => { if(confirm('로그아웃 하시겠습니까?')){ localStorage.clear(); location.reload(); } }} className="bg-slate-950 text-white p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl hover:bg-slate-800 transition-all shadow-sm">
              <Unlock size={14} className="sm:w-[18px] sm:h-[18px]" />
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
            <input type="text" placeholder="학생 검색 (이름/학번)" className="w-full bg-white border border-slate-200 rounded-2xl pl-14 pr-6 py-3 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-pink-500/10 transition-all shadow-sm" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); if(statusFilter) setStatusFilter(null); }} />
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

      {activeTab === 'list' && (
        <div className="bg-slate-900 text-white border-b border-white/5">
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 text-slate-500 text-[10px] font-black uppercase tracking-widest mr-2">
                <Info size={14} /> {statusFilter ? '필터링 활성' : '오늘의 현황'}
              </div>
              <div className="flex gap-2.5">
                <button 
                  onClick={() => setStatusFilter(statusFilter === 'late' ? null : 'late')}
                  className={`px-3 py-1.5 rounded-xl flex items-center gap-2 transition-all active:scale-95 shadow-lg ${statusFilter === 'late' ? 'bg-yellow-400 text-slate-950 ring-4 ring-yellow-400/20' : 'bg-yellow-400/20 text-yellow-400 hover:bg-yellow-400/30'}`}
                >
                  <span className="text-[10px] font-black opacity-60 uppercase">지각</span>
                  <span className="text-xs font-black">{currentDayStats.late}</span>
                </button>
                <button 
                  onClick={() => setStatusFilter(statusFilter === 'absent' ? null : 'absent')}
                  className={`px-3 py-1.5 rounded-xl flex items-center gap-2 transition-all active:scale-95 shadow-lg ${statusFilter === 'absent' ? 'bg-red-500 text-white ring-4 ring-red-500/20' : 'bg-red-500/20 text-red-500 hover:bg-red-500/30'}`}
                >
                  <span className="text-[10px] font-black opacity-60 uppercase">결석</span>
                  <span className="text-xs font-black">{currentDayStats.absent}</span>
                </button>
                <button 
                  onClick={() => setStatusFilter(statusFilter === 'normal' ? null : 'normal')}
                  className={`px-3 py-1.5 rounded-xl flex items-center gap-2 transition-all active:scale-95 border ${statusFilter === 'normal' ? 'bg-white text-slate-950 ring-4 ring-white/20' : 'bg-white/10 text-white border-white/10 hover:bg-white/20'}`}
                >
                  <span className="text-[10px] font-black opacity-40 uppercase">정상</span>
                  <span className="text-xs font-black">{currentDayStats.normal}</span>
                </button>
                {statusFilter && (
                  <button onClick={() => setStatusFilter(null)} className="ml-2 text-[10px] font-black text-pink-400 hover:text-pink-300">필터 해제</button>
                )}
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
            {!searchQuery && !statusFilter && currentYear === null && (
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

            {!searchQuery && !statusFilter && currentYear !== null && currentClass === null && (
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

            {(searchQuery || statusFilter || (currentYear !== null && currentClass !== null)) && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-5">
                {!searchQuery && !statusFilter && (
                  <div className="flex items-center justify-between">
                    <button onClick={() => setCurrentClass(null)} className="flex items-center gap-2 text-slate-500 font-black hover:text-pink-600 transition-colors">
                      <ChevronLeft size={20} /> 반 선택으로
                    </button>
                    <div className="flex items-center gap-2 bg-pink-50 text-pink-600 px-4 py-2 rounded-2xl font-black text-sm border border-pink-100">
                      {currentYear}학년 {currentClass}반
                    </div>
                  </div>
                )}
                {(searchQuery || statusFilter) && (
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-slate-400 font-bold">
                      {searchQuery ? <Search size={16} /> : <Info size={16} />}
                      {searchQuery ? `'${searchQuery}' 검색 결과` : `${statusFilter === 'late' ? '지각생' : statusFilter === 'absent' ? '결석생' : '정상 출석'} 명단`} 
                      ({filteredStudents.length}명)
                    </div>
                    {statusFilter && !searchQuery && (
                      <button onClick={resetFilters} className="text-xs font-black text-slate-400 hover:text-pink-500">초기화</button>
                    )}
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
                       <p className="font-bold">조건에 맞는 학생이 없습니다.</p>
                       <button onClick={resetFilters} className="mt-4 text-pink-500 font-black text-xs border-b border-pink-500 pb-1">전체 보기로 돌아가기</button>
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
            setStudents={(stds) => { isLocalChange.current = true; setStudents(stds); }}
            violations={violations}
            setViolations={(viols) => { isLocalChange.current = true; setViolations(viols); }}
            attendance={attendance}
            selectedDate={selectedDate}
            syncKey={"firebase_v1"}
            onClose={() => setActiveTab('list')}
          />
        )}
      </main>

      <footer className="py-10 text-center border-t border-slate-100 bg-white">
        <div className="flex items-center justify-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest">
          <span>석포여중 지각관리시스템 v14.4 (One-line Mobile)</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
