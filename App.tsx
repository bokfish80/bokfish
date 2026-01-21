
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { generateInitialStudents, DEFAULT_VIOLATIONS } from './constants';
import { AttendanceState, AttendanceStatus, AttendanceEntry, Student, ViolationOption } from './types';
import StudentCard from './components/StudentCard';
import StatsDashboard from './components/StatsDashboard';
import AdminPanel from './components/AdminPanel';
import { Search, Calendar, TrendingUp, UserCheck, LayoutGrid, GraduationCap, ChevronLeft, Lock, Unlock, ArrowRight, Heart, Wifi, WifiOff, RefreshCw, Smartphone, Save, ShieldCheck, Settings, Loader2, Database } from 'lucide-react';

// 1. 기기 고유 ID 고정 (절대 변하지 않음)
const getDeviceId = () => {
  let id = localStorage.getItem('seokpo_fixed_id_v7');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('seokpo_fixed_id_v7', id);
  }
  return id;
};

const DEVICE_ID = getDeviceId();
const BUCKET_ID = "AnV9v8pB3vB6g7r9q8zX1";
const BASE_KEY = "seokpo_v7_atomic"; // 버전업을 통해 기존 꼬인 데이터 무시

const App: React.FC = () => {
  const STORAGE_KEY_PREFIX = 'sg_v7_';
  
  const [authCode, setAuthCode] = useState<string>(() => localStorage.getItem(STORAGE_KEY_PREFIX + 'auth') || '');
  const [isSetup, setIsSetup] = useState<boolean>(authCode === '1111');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'stats' | 'admin'>('list');
  
  const [currentYear, setCurrentYear] = useState<number | null>(null);
  const [currentClass, setCurrentClass] = useState<number | null>(null);

  // 메인 데이터 상태
  const [attendance, setAttendance] = useState<AttendanceState>({});
  const [students, setStudents] = useState<Student[]>([]);
  const [violations, setViolations] = useState<ViolationOption[]>(DEFAULT_VIOLATIONS);

  // 동기화 상태 관리
  const lastUpdateAtRef = useRef<number>(0);
  const [isAppReady, setIsAppReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'connected' | 'syncing' | 'error' | 'idle'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [isLocalChanged, setIsLocalChanged] = useState(false);

  const syncKey = useMemo(() => isSetup ? `${BASE_KEY}_${authCode}` : '', [isSetup, authCode]);

  // [핵심] 데이터 병합 로직 (서버 데이터와 로컬 데이터를 합침)
  const mergeData = (remote: any) => {
    if (!remote || !remote.timestamp) return;

    // 서버 데이터가 내 현재 기록보다 최신일 때만 병합 수행
    if (remote.timestamp > lastUpdateAtRef.current) {
      setAttendance(prev => {
        const merged = { ...prev };
        // 날짜별로 순회하며 병합
        Object.keys(remote.attendance || {}).forEach(date => {
          merged[date] = { ...(merged[date] || {}), ...remote.attendance[date] };
        });
        return merged;
      });

      // 학생 명단이 서버에 더 많거나 다르면 업데이트
      if (remote.students && remote.students.length >= students.length) {
        setStudents(remote.students);
      }
      
      setViolations(remote.violations || DEFAULT_VIOLATIONS);
      lastUpdateAtRef.current = remote.timestamp;
      setLastSyncTime(new Date().toLocaleTimeString());
    }
  };

  // 클라우드에서 가져오기 (Pull)
  const pull = useCallback(async (isInitial = false) => {
    if (!syncKey) return;
    setSyncStatus('syncing');
    
    try {
      const res = await fetch(`https://kvdb.io/${BUCKET_ID}/${syncKey}`);
      if (res.ok) {
        const text = await res.text();
        if (text && text !== "null") {
          const remoteData = JSON.parse(text);
          mergeData(remoteData);
        }
      }
      setSyncStatus('connected');
      if (isInitial) setIsAppReady(true);
    } catch (e) {
      setSyncStatus('error');
      if (isInitial) setIsAppReady(true);
    }
  }, [syncKey, students.length]);

  // 클라우드에 저장하기 (Push)
  const push = useCallback(async (force = false) => {
    if (!syncKey || !isAppReady || (!isLocalChanged && !force)) return;

    setSyncStatus('syncing');
    try {
      const now = Date.now();
      const payload = {
        attendance,
        students,
        violations,
        timestamp: now,
        updatedBy: DEVICE_ID
      };

      const res = await fetch(`https://kvdb.io/${BUCKET_ID}/${syncKey}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' }
      });

      if (res.ok) {
        lastUpdateAtRef.current = now;
        setLastSyncTime(new Date().toLocaleTimeString());
        setIsLocalChanged(false);
        setSyncStatus('connected');
      } else {
        setSyncStatus('error');
      }
    } catch (e) {
      setSyncStatus('error');
    }
  }, [syncKey, isAppReady, attendance, students, violations, isLocalChanged]);

  // 1. 초기 로딩: 로컬 데이터 로드 후 즉시 서버 데이터와 병합
  useEffect(() => {
    if (!isSetup) return;
    
    const savedAttr = localStorage.getItem(`${STORAGE_KEY_PREFIX}attr`);
    const savedStds = localStorage.getItem(`${STORAGE_KEY_PREFIX}std`);
    if (savedAttr) setAttendance(JSON.parse(savedAttr));
    if (savedStds) {
      const parsed = JSON.parse(savedStds);
      if (parsed.length > 0) setStudents(parsed);
      else setStudents(generateInitialStudents());
    } else {
      setStudents(generateInitialStudents());
    }

    pull(true); // 서버 데이터 가져오기 (첫 실행)
  }, [isSetup]);

  // 2. 실시간 동기화 (3초마다 서버 체크 - Firebase 스타일)
  useEffect(() => {
    if (!isSetup || !isAppReady) return;
    const interval = setInterval(() => pull(false), 3000);
    return () => clearInterval(interval);
  }, [isSetup, isAppReady, pull]);

  // 3. 데이터 변경 감지 시 자동 Push (수정 후 1.5초 뒤)
  useEffect(() => {
    if (!isSetup || !isAppReady) return;

    localStorage.setItem(`${STORAGE_KEY_PREFIX}attr`, JSON.stringify(attendance));
    localStorage.setItem(`${STORAGE_KEY_PREFIX}std`, JSON.stringify(students));

    if (isLocalChanged) {
      const timer = setTimeout(() => push(), 1500);
      return () => clearTimeout(timer);
    }
  }, [attendance, students, isLocalChanged, push]);

  const updateStatus = (status: AttendanceStatus | null, studentId: string, options?: Partial<AttendanceEntry>) => {
    setIsLocalChanged(true); // 내가 직접 고쳤음을 표시
    setAttendance(prev => {
      const newDayRecords = { ...(prev[selectedDate] || {}) };
      if (status === null) delete newDayRecords[studentId];
      else newDayRecords[studentId] = { ...(newDayRecords[studentId] || {}), type: status, ...options } as AttendanceEntry;
      return { ...prev, [selectedDate]: newDayRecords };
    });
  };

  const handleLogin = (val: string) => {
    if (val === '1111') {
      localStorage.setItem(STORAGE_KEY_PREFIX + 'auth', val);
      setAuthCode(val);
      setIsSetup(true);
    } else {
      alert('비밀번호가 틀립니다. (1111)');
    }
  };

  const handleLogout = () => {
    if (confirm('로그아웃 하시겠습니까? 데이터는 클라우드에 보관됩니다.')) {
      localStorage.removeItem(STORAGE_KEY_PREFIX + 'auth');
      window.location.reload();
    }
  };

  // 초기 로딩 스크린 (데이터가 꼬이는 것을 방지하기 위한 안전장치)
  if (isSetup && !isAppReady) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="space-y-6 animate-pulse">
          <Database size={64} className="text-pink-500 mx-auto" />
          <h2 className="text-2xl font-black text-white">서버 데이터 병합 중...</h2>
          <p className="text-slate-500 font-bold">다른 기기의 정보를 안전하게 가져오고 있습니다.</p>
        </div>
      </div>
    );
  }

  // 로그인 화면
  if (!isSetup) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full space-y-10">
          <div className="bg-pink-600/20 w-24 h-24 rounded-[2.5rem] flex items-center justify-center text-white mx-auto shadow-2xl border border-pink-500/30">
            <Lock size={48} className="text-pink-500" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight leading-tight">석포여자중학교<br/><span className="text-pink-500">지각관리시스템</span></h1>
            <p className="text-slate-500 mt-3 font-medium text-sm">기기 간 실시간 동기화를 위해 "1111"을 입력하세요.</p>
          </div>
          <div className="bg-slate-900/50 p-10 rounded-[3rem] border border-white/5 space-y-8 shadow-3xl">
            <input 
              autoFocus
              type="password" 
              inputMode="numeric"
              maxLength={4}
              placeholder="••••"
              className="w-full bg-slate-800/50 border-none rounded-3xl px-6 py-6 text-4xl font-black text-pink-500 placeholder:text-slate-700 text-center tracking-[1em]"
              onKeyDown={(e) => e.key === 'Enter' && handleLogin(e.currentTarget.value)}
            />
            <button 
              onClick={() => { const input = document.querySelector('input') as HTMLInputElement; handleLogin(input.value); }}
              className="w-full bg-white text-slate-950 py-5 rounded-2xl font-black text-lg hover:bg-pink-500 hover:text-white transition-all shadow-xl"
            >
              로그인 및 동기화 시작
            </button>
          </div>
        </div>
      </div>
    );
  }

  const stats = {
    total: students.length,
    late: Object.values(attendance[selectedDate] || {}).filter(r => r.type === 'late').length,
    absent: Object.values(attendance[selectedDate] || {}).filter(r => r.type === 'absent').length,
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      <header className="glass sticky top-0 z-40 border-b border-slate-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 cursor-pointer" onClick={() => {setCurrentYear(null); setCurrentClass(null); setActiveTab('list');}}>
              <div className="bg-slate-950 p-3 rounded-2xl text-white shadow-xl">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">석포여중 지각관리</h1>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border transition-all ${syncStatus === 'error' ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
                    {syncStatus === 'syncing' ? <RefreshCw size={10} className="text-pink-500 animate-spin" /> : <Wifi size={10} className={syncStatus === 'error' ? 'text-orange-500' : 'text-green-500'} />}
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">
                      {syncStatus === 'syncing' ? '데이터 동기화 중' : lastSyncTime ? `${lastSyncTime} 실시간 연동됨` : '클라우드 연동됨'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => push(true)}
                className={`flex items-center gap-2 px-4 py-3 rounded-2xl font-black text-xs transition-all ${isLocalChanged ? 'bg-pink-600 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-400'}`}
              >
                <Save size={16} /> <span className="hidden sm:inline">서버 강제 저장</span>
              </button>
              <button onClick={handleLogout} className="bg-slate-950 text-white p-3.5 rounded-2xl hover:bg-slate-800 transition-all shadow-sm"><Unlock size={18} /></button>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row gap-3 mt-5">
            <div className="relative flex items-center bg-white rounded-2xl px-5 py-3.5 border border-slate-200 shadow-sm w-full md:w-auto">
              <Calendar size={18} className="text-pink-500 mr-3" />
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-transparent text-sm font-black focus:outline-none text-slate-700 w-full" />
            </div>
            <div className="relative flex-1">
              <Search size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="학생 이름이나 학번으로 검색..." className="w-full bg-white border border-slate-200 rounded-2xl pl-14 pr-6 py-3.5 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-pink-500/10 shadow-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <nav className="flex gap-8 overflow-x-auto scrollbar-hide">
            {[
              { id: 'list', label: '지각 체크', icon: LayoutGrid },
              { id: 'stats', label: '통계 분석', icon: TrendingUp },
              { id: 'admin', label: '명단 수정', icon: ShieldCheck }
            ].map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`pb-4 pt-2 text-sm font-black transition-all flex items-center gap-2 border-b-4 shrink-0 ${activeTab === tab.id ? 'border-pink-600 text-pink-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                <tab.icon size={18} /> {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">오늘의 요약</span>
            <div className="flex gap-2">
              <span className="bg-yellow-400 text-slate-900 px-3 py-1 rounded-full text-[10px] font-black">지각 {stats.late}</span>
              <span className="bg-red-500 text-white px-3 py-1 rounded-full text-[10px] font-black">결석 {stats.absent}</span>
              <span className="bg-white/10 text-white px-3 py-1 rounded-full text-[10px] font-black">정상 {stats.total - (stats.late + stats.absent)}</span>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-[10px] font-black text-slate-500">
            <Smartphone size={14} /> 기기ID: {DEVICE_ID}
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto px-4 md:px-8 py-8 w-full">
        {activeTab === 'admin' ? (
          <AdminPanel 
            students={students} 
            setStudents={(newStds) => { setIsLocalChanged(true); setStudents(newStds); }} 
            violations={violations} 
            setViolations={(newVios) => { setIsLocalChanged(true); setViolations(newVios); }} 
            attendance={attendance} 
            selectedDate={selectedDate} 
            syncKey={syncKey} 
            onClose={() => setActiveTab('list')} 
          />
        ) : activeTab === 'list' ? (
          <div className="space-y-8">
            {(currentYear === null && !searchQuery) ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map(year => (
                  <button key={year} onClick={() => setCurrentYear(year)} className="group bg-white border border-slate-200 p-12 rounded-[3rem] transition-all hover:shadow-2xl hover:border-pink-500/50 flex flex-col items-center">
                    <div className="bg-slate-50 p-8 rounded-[2rem] text-slate-300 group-hover:bg-pink-500 group-hover:text-white transition-all mb-6">
                      <GraduationCap className="w-12 h-12" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 group-hover:text-pink-600">{year}학년</h3>
                  </button>
                ))}
              </div>
            ) : (currentClass === null && !searchQuery) ? (
              <div className="space-y-6">
                <button onClick={() => setCurrentYear(null)} className="flex items-center gap-2 text-slate-500 font-black hover:text-pink-600"><ChevronLeft size={20} /> 학년 선택으로</button>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map(cls => (
                    <button key={cls} onClick={() => setCurrentClass(cls)} className="bg-white border border-slate-200 p-8 rounded-3xl hover:border-pink-500 hover:shadow-xl transition-all font-black text-xl text-slate-900">{cls}반</button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {!searchQuery && <button onClick={() => setCurrentClass(null)} className="flex items-center gap-2 text-slate-500 font-black hover:text-pink-600"><ChevronLeft size={20} /> 반 선택으로</button>}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {students
                    .filter(s => searchQuery ? (s.name.includes(searchQuery) || s.studentNumber.includes(searchQuery)) : (s.year === currentYear && s.classGroup === currentClass))
                    .map(student => (
                      <StudentCard key={student.id} student={student} entry={attendance[selectedDate]?.[student.id]} violations={violations} onStatusChange={(status, options) => updateStatus(status, student.id, options)} />
                    ))
                  }
                </div>
              </div>
            )}
          </div>
        ) : (
          <StatsDashboard attendance={attendance} students={students} />
        )}
      </main>

      <footer className="py-8 text-center border-t border-slate-100 bg-white">
         <div className="flex items-center justify-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
           <span>석포여자중학교 지각관리 v7.0 (Merge-Sync)</span>
           <span className="w-1 h-1 rounded-full bg-slate-200"></span>
           <span className="flex items-center gap-1.5">제작: 김용섭 <Heart size={10} className="text-pink-500 fill-pink-500" /></span>
         </div>
      </footer>
    </div>
  );
}

export default App;
