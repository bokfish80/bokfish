
import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { AttendanceState, Student, AttendanceEntry } from '../types';
import { Sparkles, RefreshCw, AlertTriangle, MessageCircle, TrendingUp } from 'lucide-react';

interface AiInsightsProps {
  attendance: AttendanceState;
  students: Student[];
  selectedDate: string;
}

const AiInsights: React.FC<AiInsightsProps> = ({ attendance, students, selectedDate }) => {
  const [insight, setInsight] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const generateInsight = async () => {
    // API_KEY must be obtained exclusively from the environment variable process.env.API_KEY.
    if (!process.env.API_KEY) {
      setError("Gemini API 키가 설정되지 않았습니다.");
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const currentDay = attendance[selectedDate] || {};
      
      // Cast entry to AttendanceEntry for all filter/map operations
      const lateList = Object.entries(currentDay)
        .filter(([_, entry]) => (entry as AttendanceEntry).type === 'late')
        .map(([id, entryAny]) => {
          const entry = entryAny as AttendanceEntry;
          const s = students.find(std => std.id === id);
          return `${s?.name}(${entry.time || '시간미정'})`;
        });
      
      const absentList = Object.entries(currentDay)
        .filter(([_, entry]) => (entry as AttendanceEntry).type === 'absent')
        .map(([id]) => students.find(std => std.id === id)?.name)
        .filter(Boolean);

      const violationList = Object.entries(currentDay)
        .filter(([_, entry]) => (entry as AttendanceEntry).type === 'violation')
        .map(([id, entryAny]) => {
          const entry = entryAny as AttendanceEntry;
          const s = students.find(std => std.id === id);
          return `${s?.name}(${entry.violationType || '기타 위반'})`;
        });

      const prompt = `
        다음은 석포여자중학교 ${selectedDate}일자 학생 지도 요약 데이터입니다:
        - 전체 인원: ${students.length}명
        - 지각 명단 (${lateList.length}명): ${lateList.join(', ') || '없음'}
        - 결석 명단 (${absentList.length}명): ${absentList.join(', ') || '없음'}
        - 교칙 위반 명단 (${violationList.length}명): ${violationList.join(', ') || '없음'}

        이 데이터를 바탕으로 다음 내용을 한국어로 작성해줘:
        1. 오늘 학급 생활 태도 진단 (지각 시간과 교칙 위반 항목의 연관성이나 분위기를 분석해줘)
        2. 학생 생활 지도를 위한 선생님의 팁 (위반 학생들의 특성을 고려한 구체적인 지도 방안)
        3. 오늘 학생들에게 전달할 따뜻한 훈화 말씀 한마디

        친근하면서도 신뢰감 있는 중학교 선생님 말투를 사용해줘.
      `;

      // Use ai.models.generateContent to query GenAI with both the model name and prompt.
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      // The simplest and most direct way to get the generated text content is by accessing the .text property.
      // Do not use response.text().
      setInsight(response.text || "데이터 분석에 실패했습니다.");
    } catch (err: any) {
      console.error(err);
      setError("AI 엔진 연결 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generateInsight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-gradient-to-br from-slate-900 via-pink-900/20 to-indigo-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden border border-white/10">
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 p-2.5 rounded-2xl backdrop-blur-xl border border-white/20">
                <Sparkles size={24} className="text-pink-300" />
              </div>
              <h2 className="text-2xl font-black tracking-tight">AI 학생 지도 리포트</h2>
            </div>
            <button 
              onClick={generateInsight}
              disabled={loading}
              className="p-2 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
            >
              <RefreshCw size={20} className={`${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-4">
              <div className="relative">
                <div className="w-12 h-12 border-4 border-white/10 border-t-pink-500 rounded-full animate-spin"></div>
                <Sparkles size={16} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-pink-300" />
              </div>
              <p className="text-pink-200 font-bold animate-pulse">생활 지도 데이터를 심층 분석 중입니다...</p>
            </div>
          ) : error ? (
            <div className="bg-red-500/20 border border-red-500/30 rounded-2xl p-6 text-center text-white">
              <AlertTriangle className="mx-auto mb-3 text-red-300" size={32} />
              <p className="text-red-100 font-bold mb-2">{error}</p>
              <button onClick={generateInsight} className="text-sm font-black bg-white text-red-600 px-4 py-2 rounded-xl hover:bg-red-50 transition-colors">다시 시도</button>
            </div>
          ) : (
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 md:p-8">
              <div className="prose prose-invert max-w-none">
                <div className="whitespace-pre-wrap leading-relaxed text-pink-50 font-medium text-lg">
                  {insight}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="absolute top-0 right-0 w-96 h-96 bg-pink-500/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-indigo-500/10 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/3"></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-purple-50 p-2 rounded-lg text-purple-600">
              <MessageCircle size={20} />
            </div>
            <h3 className="font-black text-slate-800 uppercase tracking-tight">맞춤형 지도 제언</h3>
          </div>
          <p className="text-sm text-slate-500 font-medium leading-relaxed">
            AI는 학생들의 지각 시간과 구체적인 교칙 위반 항목(복장, 명찰 등)을 분석하여 반복적인 패턴이 나타나는 학생에 대한 집중 상담 전략을 제안합니다.
          </p>
        </div>
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-green-50 p-2 rounded-lg text-green-600">
              <TrendingUp size={20} />
            </div>
            <h3 className="font-black text-slate-800 uppercase tracking-tight">생활 태도 지수</h3>
          </div>
          <p className="text-sm text-slate-500 font-medium leading-relaxed">
            데이터가 축적될수록 학급의 전반적인 생활 태도 변화를 더 정밀하게 예측할 수 있습니다. 위반 빈도가 줄어드는 추세를 격려의 수단으로 활용하세요.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AiInsights;
