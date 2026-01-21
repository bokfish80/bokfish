
import { Student, ViolationOption } from './types';

// 기본 교칙 위반 항목
export const DEFAULT_VIOLATIONS: ViolationOption[] = [
  { id: 'v-1', label: '복장규정 위반' },
  { id: 'v-2', label: '명찰 미착용' },
  { id: 'v-3', label: '가방 미소지' }
];

const lastNames = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '전', '홍'];
const firstNames = ['민준', '서준', '도윤', '예준', '시우', '하준', '주원', '지호', '지후', '준서', '서연', '서윤', '지우', '서현', '하은', '하윤', '민서', '지유', '윤서', '채원'];

// 초기 목업 데이터 생성 함수 (1~3학년, 1~4반 고정)
export const generateInitialStudents = (): Student[] => {
  return Array.from({ length: 100 }, (_, i) => {
    const lastName = lastNames[i % lastNames.length];
    const firstName = firstNames[Math.floor(i / 5) % firstNames.length];
    
    // 학년: 1, 2, 3학년 순환
    const year = (i % 3) + 1;
    // 반: 1, 2, 3, 4반 순환
    const classGroup = (Math.floor(i / 3) % 4) + 1;
    // 번호: 반별로 적절히 배정 (1~25번 사이)
    const num = (Math.floor(i / 12) + 1).toString().padStart(2, '0');

    return {
      id: `std-${year}-${classGroup}-${num}-${i}`,
      name: `${lastName}${firstName}`,
      studentNumber: `${year}${classGroup}${num}`,
      year,
      classGroup
    };
  });
};

export const STATUS_COLORS = {
  late: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  absent: 'bg-red-100 text-red-700 border-red-200',
  violation: 'bg-purple-100 text-purple-700 border-purple-200',
};

export const STATUS_LABELS = {
  late: '지각',
  absent: '결석',
  violation: '교칙위반',
};
