import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  BookOpen, 
  Award, 
  Check, 
  Plus, 
  Minus, 
  Search, 
  Users, 
  X, 
  Calendar, 
  Edit2, 
  Trash2, 
  Settings, 
  User, 
  UserCheck, 
  Smile, 
  Crown, 
  Database, 
  Sparkles, 
  Camera, 
  ChevronDown, 
  ChevronUp, 
  UserPlus,
  Table,
  Clock,
  Brain,
  Star
} from 'lucide-react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, collection, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

// --- DATA TYPES ---
interface Student {
  id: string;
  name: string;
  gender: 'M' | 'F';
  birthDate: string; // YYYY-MM-DD
  photo?: string; // base64 URL
  createdAt: string;
}

interface Record {
  id: string; // studentId_date
  studentId: string;
  date: string; // YYYY-MM-DD
  asistencia: boolean;
  puntualidad: boolean;
  biblia: boolean;
  participacion: boolean;
  versiculo: boolean;
  visitas: number;
  puntosExtras: number;
}

interface Period {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

// --- ERROR HANDLING AS PER SKILL MANDATES ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    isAnonymous?: boolean | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, auth: any) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- FIREBASE INITIALIZATION ---
let app;
let db: any = null;
let auth: any = null;
let isFirebaseConfigured = false;

if (firebaseConfig && firebaseConfig.apiKey && !firebaseConfig.apiKey.includes('mock-api-key-replace')) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    auth = getAuth(app);
    isFirebaseConfigured = true;
  } catch (error) {
    console.warn("Firebase config is invalid or needs setup:", error);
  }
}

// --- CUSTOM DATE HELPERS ---
const todayStr = new Date().toISOString().split('T')[0];

export default function App() {
  // --- GENERAL STATE ---
  const [classCode, setClassCode] = useState<string>(() => localStorage.getItem('classCode') || 'PIEDRAS_VIVAS');
  const [isCloudMode, setIsCloudMode] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null);

  // --- MODEL STATE ---
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<Record[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');

  // --- NAVIGATION AND VIEW CONTROL ---
  const [activeTab, setActiveTab] = useState<'registro' | 'ranking' | 'alumnos' | 'config'>('registro');
  const [registroDate, setRegistroDate] = useState<string>(todayStr);
  const [registroMode, setRegistroMode] = useState<'individual' | 'tabla'>('individual');
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  // --- FILTERS STATE ---
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [genderFilter, setGenderFilter] = useState<'Todos' | 'M' | 'F'>('Todos'); // M: Masculino (Hombres), F: Femenino (Mujeres)

  // --- MODALS AND FORMS STATE ---
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentGender, setNewStudentGender] = useState<'M' | 'F'>('M');
  const [newStudentBirthDate, setNewStudentBirthDate] = useState('2012-01-01');
  const [newStudentPhoto, setNewStudentPhoto] = useState<string>('');
  const [newStudentInitialPoints, setNewStudentInitialPoints] = useState<number | ''>('');

  // Periods Modal
  const [isPeriodModalOpen, setIsPeriodModalOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<Period | null>(null);
  const [newPeriodName, setNewPeriodName] = useState('');
  const [newPeriodStart, setNewPeriodStart] = useState('');
  const [newPeriodEnd, setNewPeriodEnd] = useState('');

  // Delete Alert Modal
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'student' | 'period'; id: string; name: string } | null>(null);

  // --- AUTOMATIC ANONYMOUS FIREBASE AUTH ---
  useEffect(() => {
    if (isFirebaseConfigured && auth) {
      signInAnonymously(auth)
        .then((cred) => {
          setUserId(cred.user.uid);
          setIsCloudMode(true);
        })
        .catch((error) => {
          console.warn("Auth failed or skipped. Operating in local-fallback mode.", error);
          setIsCloudMode(false);
        });
    } else {
      setIsCloudMode(false);
    }
  }, [classCode]);

  // --- SYNCING & SUBSCRIPTION ENGINE (DUAL MODE) ---
  useEffect(() => {
    // If local offline fallback is active
    if (!isCloudMode || !db) {
      const localStudents = JSON.parse(localStorage.getItem(`students_${classCode}`) || '[]');
      const localRecords = JSON.parse(localStorage.getItem(`records_${classCode}`) || '[]');
      const localPeriods = JSON.parse(localStorage.getItem(`periods_${classCode}`) || '[]');
      setStudents(localStudents);
      setRecords(localRecords);
      setPeriods(localPeriods);
      return;
    }

    // Live sync for Students
    const unsubStudents = onSnapshot(collection(db, `students_${classCode}`), (snapshot) => {
      const list: Student[] = [];
      snapshot.forEach((doc) => list.push(doc.data() as Student));
      setStudents(list);
      localStorage.setItem(`students_${classCode}`, JSON.stringify(list));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `students_${classCode}`, auth);
    });

    // Live sync for Records
    const unsubRecords = onSnapshot(collection(db, `records_${classCode}`), (snapshot) => {
      const list: Record[] = [];
      snapshot.forEach((doc) => list.push(doc.data() as Record));
      setRecords(list);
      localStorage.setItem(`records_${classCode}`, JSON.stringify(list));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `records_${classCode}`, auth);
    });

    // Live sync for Periods
    const unsubPeriods = onSnapshot(collection(db, `periods_${classCode}`), (snapshot) => {
      const list: Period[] = [];
      snapshot.forEach((doc) => list.push(doc.data() as Period));
      setPeriods(list);
      localStorage.setItem(`periods_${classCode}`, JSON.stringify(list));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `periods_${classCode}`, auth);
    });

    return () => {
      unsubStudents();
      unsubRecords();
      unsubPeriods();
    };
  }, [classCode, isCloudMode, userId]);

  // --- SEED SEEDER AUTOMATION ---
  useEffect(() => {
    const isSeeded = localStorage.getItem(`seeded_${classCode}`);
    if (isSeeded) return;

    // Check if empty in active state
    if (students.length === 0 && periods.length === 0) {
      // Create period base
      const past20Days = new Date();
      past20Days.setDate(past20Days.getDate() - 20);
      const startString = past20Days.toISOString().split('T')[0];

      const fut35Days = new Date();
      fut35Days.setDate(fut35Days.getDate() + 35);
      const endString = fut35Days.toISOString().split('T')[0];

      const initialPeriod: Period = {
        id: 'bimestre_base',
        name: 'Bimestre Actual',
        startDate: startString,
        endDate: endString
      };

      // Write to LocalStorage
      localStorage.setItem(`periods_${classCode}`, JSON.stringify([initialPeriod]));
      localStorage.setItem(`students_${classCode}`, JSON.stringify([]));
      localStorage.setItem(`records_${classCode}`, JSON.stringify([]));
      localStorage.setItem(`seeded_${classCode}`, 'true');

      // Update state
      setPeriods([initialPeriod]);
      setStudents([]);
      setRecords([]);

      // If online write immediately to Cloud
      if (isCloudMode && db) {
        setDoc(doc(db, `periods_${classCode}`, initialPeriod.id), initialPeriod).catch(() => {});
      }
    }
  }, [students, periods, classCode, isCloudMode]);

  // --- ACTIVE PERIOD AUTO SELECTION ---
  const activePeriod = useMemo(() => {
    if (periods.length === 0) return null;
    
    // If a period is already selected, use it
    if (selectedPeriodId) {
      const match = periods.find(p => p.id === selectedPeriodId);
      if (match) return match;
    }

    // Otherwise, discover matching period containing today's date
    const today = new Date(todayStr);
    const encompassing = periods.find(p => {
      const start = new Date(p.startDate);
      const end = new Date(p.endDate);
      return today >= start && today <= end;
    });

    if (encompassing) {
      return encompassing;
    }
    // Default to the first one available
    return periods[0];
  }, [periods, selectedPeriodId]);

  // Sync state selected id
  useEffect(() => {
    if (activePeriod && !selectedPeriodId) {
      setSelectedPeriodId(activePeriod.id);
    }
  }, [activePeriod, selectedPeriodId]);

  // Adjust date picker when active period bounds change
  useEffect(() => {
    if (activePeriod) {
      // Check if current registration date is inside period
      const current = new Date(registroDate);
      const start = new Date(activePeriod.startDate);
      const end = new Date(activePeriod.endDate);
      if (current < start || current > end) {
        setRegistroDate(activePeriod.startDate);
      }
    }
  }, [activePeriod]);

  // --- SAVE MOTIONS AND PERSISTENCE ENGINE ---
  const saveStudent = async (student: Student) => {
    const updated = [...students.filter(s => s.id !== student.id), student];
    setStudents(updated);
    localStorage.setItem(`students_${classCode}`, JSON.stringify(updated));

    if (isCloudMode && db) {
      try {
        await setDoc(doc(db, `students_${classCode}`, student.id), student);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `students_${classCode}/${student.id}`, auth);
      }
    }
  };

  const removeStudentAndLogs = async (studentId: string) => {
    // Delete student
    const updatedSt = students.filter(s => s.id !== studentId);
    setStudents(updatedSt);
    localStorage.setItem(`students_${classCode}`, JSON.stringify(updatedSt));

    // Delete records associated
    const updatedRecs = records.filter(r => r.studentId !== studentId);
    setRecords(updatedRecs);
    localStorage.setItem(`records_${classCode}`, JSON.stringify(updatedRecs));

    if (isCloudMode && db) {
      try {
        await deleteDoc(doc(db, `students_${classCode}`, studentId));
        // Delete each associated record sequentially or in snapshots
        records.filter(r => r.studentId === studentId).forEach(async (r) => {
          await deleteDoc(doc(db, `records_${classCode}`, r.id));
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `students_${classCode}/${studentId}`, auth);
      }
    }
  };

  const saveRecord = async (record: Record) => {
    const updated = [...records.filter(r => r.id !== record.id), record];
    setRecords(updated);
    localStorage.setItem(`records_${classCode}`, JSON.stringify(updated));

    if (isCloudMode && db) {
      try {
        await setDoc(doc(db, `records_${classCode}`, record.id), record);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `records_${classCode}/${record.id}`, auth);
      }
    }
  };

  const savePeriod = async (period: Period) => {
    const updated = [...periods.filter(p => p.id !== period.id), period];
    setPeriods(updated);
    localStorage.setItem(`periods_${classCode}`, JSON.stringify(updated));

    if (isCloudMode && db) {
      try {
        await setDoc(doc(db, `periods_${classCode}`, period.id), period);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `periods_${classCode}/${period.id}`, auth);
      }
    }
  };

  const removePeriod = async (periodId: string) => {
    const updated = periods.filter(p => p.id !== periodId);
    setPeriods(updated);
    localStorage.setItem(`periods_${classCode}`, JSON.stringify(updated));

    if (isCloudMode && db) {
      try {
        await deleteDoc(doc(db, `periods_${classCode}`, periodId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `periods_${classCode}/${periodId}`, auth);
      }
    }
  };

  // --- BUSINESS RULES & LOGIC CALCULATION ---
  const calculatePoints = (record: Record | undefined): number => {
    if (!record) return 0;
    if (!record.asistencia) return 0; // inactive records or absent students score zero
    
    let points = 1; // Presence is 1 point
    if (record.puntualidad) points += 1;
    if (record.biblia) points += 1;
    if (record.participacion) points += 1;
    if (record.versiculo) points += 1;
    points += (record.visitas * 3);
    points += record.puntosExtras;
    return points;
  };

  const handleFieldChange = (studentId: string, date: string, field: keyof Record, val: any) => {
    const existing = records.find(r => r.studentId === studentId && r.date === date) || {
      id: `${studentId}_${date}`,
      studentId,
      date,
      asistencia: false,
      puntualidad: false,
      biblia: false,
      participacion: false,
      versiculo: false,
      visitas: 0,
      puntosExtras: 0
    };

    const copy = { ...existing };

    if (field === 'asistencia') {
      const selectedAsis = val as boolean;
      copy.asistencia = selectedAsis;
      if (!selectedAsis) {
        // Clear children
        copy.puntualidad = false;
        copy.biblia = false;
        copy.participacion = false;
        copy.versiculo = false;
        copy.visitas = 0;
        copy.puntosExtras = 0;
      }
    } else {
      (copy as any)[field] = val;
      // Reverse trigger check
      if (typeof val === 'boolean' && val === true) {
        copy.asistencia = true;
      }
      if (field === 'visitas' && (val as number) > 0) {
        copy.asistencia = true;
      }
      if (field === 'puntosExtras' && (val as number) !== 0) {
        copy.asistencia = true;
      }
    }
    saveRecord(copy);
  };

  // --- AGE CALCULATION HELPER ---
  const getAge = (birthStr: string): string => {
    if (!birthStr) return '--';
    const bDate = new Date(birthStr);
    const today = new Date();
    let age = today.getFullYear() - bDate.getFullYear();
    const mDiff = today.getMonth() - bDate.getMonth();
    if (mDiff < 0 || (mDiff === 0 && today.getDate() < bDate.getDate())) {
      age--;
    }
    return age >= 0 ? `${age} años` : '--';
  };

  // --- SEARCH AND FILTERS ENFORCEMENT ---
  const filteredStudents = useMemo(() => {
    return students
      .filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesGender = genderFilter === 'Todos' || s.gender === genderFilter;
        return matchesSearch && matchesGender;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [students, searchQuery, genderFilter]);

  // Compute accumulated points in selected active period
  const studentScoresMap = useMemo(() => {
    const scoreMap: { [studentId: string]: number } = {};
    students.forEach(s => { scoreMap[s.id] = 0; });

    if (!activePeriod) return scoreMap;

    const start = new Date(activePeriod.startDate);
    const end = new Date(activePeriod.endDate);

    records.forEach(r => {
      const rDate = new Date(r.date);
      if (rDate >= start && rDate <= end) {
        scoreMap[r.studentId] = (scoreMap[r.studentId] || 0) + calculatePoints(r);
      }
    });

    return scoreMap;
  }, [students, records, activePeriod]);

  // --- HIGHLIGHT LEADERBOARD DATA (TOP 10) ---
  const leaderboardData = useMemo(() => {
    return filteredStudents
      .map(s => ({
        ...s,
        points: studentScoresMap[s.id] || 0
      }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 10);
  }, [filteredStudents, studentScoresMap]);

  // --- STATS SUMMARY BADGES FOR CURRENT VIEW DAY ---
  const dailySummary = useMemo(() => {
    let asistencias = 0;
    let biblias = 0;
    let visitas = 0;

    records.forEach(r => {
      if (r.date === registroDate) {
        if (r.asistencia) asistencias++;
        if (r.biblia) biblias++;
        visitas += r.visitas || 0;
      }
    });

    return { asistencias, biblias, visitas };
  }, [records, registroDate]);

  // --- CANVAS RESIZE FUNCTION FOR base64 PHOTO UPLOADS ---
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 250;

        if (width > height) {
          if (width > maxDim) {
            height *= maxDim / width;
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width *= maxDim / height;
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const base64 = canvas.toDataURL('image/jpeg', 0.85);
          setNewStudentPhoto(base64);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // --- SAVE STUDENT FROM MODAL ---
  const handleSaveStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;

    const actionId = editingStudent ? editingStudent.id : `student_${Date.now()}`;
    const studentObj: Student = {
      id: actionId,
      name: newStudentName.trim(),
      gender: newStudentGender,
      birthDate: newStudentBirthDate,
      photo: newStudentPhoto || undefined,
      createdAt: editingStudent?.createdAt || new Date().toISOString()
    };

    saveStudent(studentObj);

    // Initial Points special migration trigger
    const initialPts = newStudentInitialPoints === '' ? 0 : newStudentInitialPoints;
    if (!editingStudent && initialPts > 0 && activePeriod) {
      const initialRecord: Record = {
        id: `${actionId}_${activePeriod.startDate}`,
        studentId: actionId,
        date: activePeriod.startDate,
        asistencia: true,
        puntualidad: false,
        biblia: false,
        participacion: false,
        versiculo: false,
        visitas: 0,
        // subtract 1 because checking presence (asistencia: true) itself automatically awards 1 point
        puntosExtras: initialPts - 1
      };
      saveRecord(initialRecord);
    }

    // Reset Form
    setIsStudentModalOpen(false);
    setEditingStudent(null);
    setNewStudentName('');
    setNewStudentPhoto('');
    setNewStudentInitialPoints('');
  };

  const handleEditStudentClick = (student: Student) => {
    setEditingStudent(student);
    setNewStudentName(student.name);
    setNewStudentGender(student.gender);
    setNewStudentBirthDate(student.birthDate);
    setNewStudentPhoto(student.photo || '');
    setNewStudentInitialPoints('');
    setIsStudentModalOpen(true);
  };

  const handleEditPeriodClick = (period: Period) => {
    setEditingPeriod(period);
    setNewPeriodName(period.name);
    setNewPeriodStart(period.startDate);
    setNewPeriodEnd(period.endDate);
    setIsPeriodModalOpen(true);
  };

  // --- SAVE PERIOD FROM MODAL ---
  const handleSavePeriodSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPeriodName.trim() || !newPeriodStart || !newPeriodEnd) return;

    if (new Date(newPeriodStart) > new Date(newPeriodEnd)) {
      alert("La fecha de fin debe ser posterior a la fecha de inicio.");
      return;
    }

    const prd: Period = {
      id: editingPeriod ? editingPeriod.id : `period_${Date.now()}`,
      name: newPeriodName.trim(),
      startDate: newPeriodStart,
      endDate: newPeriodEnd
    };

    savePeriod(prd);
    setIsPeriodModalOpen(false);
    setEditingPeriod(null);
    setNewPeriodName('');
    setNewPeriodStart('');
    setNewPeriodEnd('');
  };

  return (
    <div className="min-h-screen pt-[38px] pb-18 text-slate-800 bg-[#F8FAFC] flex flex-col font-sans select-none antialiased w-full max-w-full overflow-x-clip">
      
      {/* --- UPPER HEADER (FIXED) --- */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-[#0F1626]/95 text-slate-300 backdrop-blur-md shadow-lg border-b border-slate-800">
        <div className="max-w-6xl w-full mx-auto px-4 py-1 flex items-center justify-between">
          <div className="flex items-center space-x-2 shrink-0">
            <Sparkles className="w-4 h-4 text-[#4CC9F0]" />
            <h1 className="font-display font-bold text-sm sm:text-base text-white">Clase Piedras Vivas</h1>
          </div>

          {/* Period Selector Dropdown */}
          <div className="flex items-center space-x-1.5 bg-slate-900/50 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 shrink-0">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <select 
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="bg-transparent text-slate-200 outline-none font-bold text-xs cursor-pointer max-w-[130px]"
            >
              {periods.map(p => (
                <option key={p.id} value={p.id} className="bg-[#0F1626] text-slate-200 text-xs text-left">
                  {p.name}
                </option>
              ))}
              {periods.length === 0 && (
                <option value="" className="text-xs bg-[#0F1626] text-slate-400">Sin periodos</option>
              )}
            </select>
          </div>
        </div>
      </header>

      {/* --- CONTENT AREA LIMITER --- */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-2 pt-1 pb-2 sm:px-4 sm:pt-1.5 sm:pb-3">

        {/* --- VIEW: REGISTRO (Tab 1) --- */}
        {activeTab === 'registro' && (
          <div className="space-y-2 max-w-4xl mx-auto w-full">
            
            {/* Sticky 2-line clean minimalist filters bar */}
            <div className="sticky top-[38px] z-30 bg-[#F8FAFC]/95 backdrop-blur-sm py-1 border-b border-slate-200/80 mb-0.5 space-y-1">
              {/* Row 1: Date, Totals, Mode Icons */}
              <div className="flex items-center justify-between gap-1 w-full">
                {/* Date Selector */}
                <div className="flex items-center space-x-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs shrink-0">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <input
                    type="date"
                    value={registroDate}
                    onChange={(e) => setRegistroDate(e.target.value)}
                    min={activePeriod?.startDate}
                    max={activePeriod?.endDate}
                    className="font-display font-bold text-slate-800 bg-transparent py-0.5 cursor-pointer focus:outline-none text-xs sm:text-sm max-w-[95px] sm:max-w-none"
                  />
                </div>

                {/* Dashboard summary stats in 1st line - replaced with icons and tooltips */}
                <div className="flex items-center space-x-2 text-xs sm:text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg py-1 px-2 shadow-2xs shrink-0">
                  <div className="flex items-center space-x-1" title="Total de Asistencias">
                    <UserCheck className="w-4 h-4 text-indigo-600" />
                    <span className="font-bold text-slate-800 font-mono text-xs sm:text-sm">{dailySummary.asistencias}/{students.length}</span>
                  </div>
                  <div className="w-px h-3.5 bg-slate-200" />
                  <div className="flex items-center space-x-1" title="Total de Biblias">
                    <BookOpen className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-emerald-700 font-mono text-xs sm:text-sm">{dailySummary.biblias}</span>
                  </div>
                  <div className="w-px h-3.5 bg-slate-200" />
                  <div className="flex items-center space-x-1" title="Total de Visitas">
                    <UserPlus className="w-4 h-4 text-amber-600" />
                    <span className="font-bold text-amber-700 font-mono text-xs sm:text-sm">{dailySummary.visitas}</span>
                  </div>
                </div>

                {/* Mode Selectors as Icons */}
                <div className="flex items-center space-x-0.5 bg-white p-0.5 rounded-lg border border-slate-200 shadow-2xs shrink-0">
                  <button 
                    onClick={() => setRegistroMode('individual')}
                    title="Vista Individual (Acordeón)"
                    className={`p-1.5 rounded-md transition-all cursor-pointer ${
                      registroMode === 'individual' 
                        ? 'bg-indigo-50 text-indigo-650 border border-indigo-150 font-bold' 
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <User className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setRegistroMode('tabla')}
                    title="Vista Tabla"
                    className={`p-1.5 rounded-md transition-all cursor-pointer ${
                      registroMode === 'tabla' 
                        ? 'bg-indigo-50 text-indigo-650 border border-indigo-150 font-bold' 
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Table className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Row 2: Search Query and Gender Filters */}
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center">
                    <Search className="h-4 w-4 text-slate-400" />
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar alumno en registro..."
                    className="block w-full pl-9 pr-8 py-1.5 border border-slate-200 rounded-lg text-xs sm:text-sm bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-150 font-medium transition-all shadow-2xs"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-3 flex items-center">
                      <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                    </button>
                  )}
                </div>

                <div className="flex border border-slate-200 rounded-lg bg-white p-0.5 shadow-2xs shrink-0">
                  {(['Todos', 'M', 'F'] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => setGenderFilter(g)}
                      title={g === 'Todos' ? 'Todos' : g === 'M' ? 'Hombres' : 'Mujeres'}
                      className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer flex items-center justify-center min-w-[32px] ${
                        genderFilter === g 
                          ? 'bg-indigo-100 text-indigo-700 border-indigo-200 font-bold' 
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {g === 'Todos' ? <Users className="w-4 h-4" /> : g === 'M' ? 'H' : 'M'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Main scrollable list for students */}
            <div className="space-y-4">
              {/* List Body according to Mode selected */}
              {registroMode === 'individual' ? (
                <div className="space-y-2.5">
                  {filteredStudents.map(student => {
                    const record = records.find(r => r.studentId === student.id && r.date === registroDate);
                    const isExpanded = expandedStudentId === student.id;
                    const ptsToday = calculatePoints(record);

                    return (
                      <div 
                        key={student.id} 
                        className={`rounded-2xl overflow-hidden transition-all duration-200 border ${
                          isExpanded 
                            ? 'border-slate-800 bg-slate-50 shadow-md' 
                            : 'border-slate-200 bg-white hover:bg-slate-50/50 shadow-xs'
                        }`}
                      >
                        {/* Collapse Handle bar */}
                        <div 
                          onClick={() => setExpandedStudentId(isExpanded ? null : student.id)}
                          className="p-2.5 sm:p-3 flex items-center justify-between cursor-pointer hover:bg-slate-100/50"
                        >
                          <div className="flex items-center space-x-3.5">
                            {student.photo ? (
                              <img src={student.photo} alt={student.name} referrerPolicy="no-referrer" className={`w-10 h-10 rounded-full object-cover shadow-xs shrink-0 border-2 ${student.gender === 'M' ? 'border-sky-300' : 'border-rose-300'}`} />
                            ) : (
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-inner shrink-0 border-2 ${student.gender === 'M' ? 'bg-sky-50 text-sky-600 border-sky-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
                                {student.name.charAt(0)}
                              </div>
                            )}
                            <div>
                              <h4 className="font-bold text-slate-900 text-[14px] sm:text-base leading-tight">{student.name}</h4>
                              {/* Row of status icons (replaces age & sex) */}
                              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                {/* Asistencia */}
                                <span 
                                  title={record?.asistencia ? "Asistencia: Sí" : "Asistencia: No"}
                                  className={`p-1 rounded-md border flex items-center justify-center transition-all ${
                                    record?.asistencia 
                                      ? "bg-indigo-50 text-indigo-600 border-indigo-150" 
                                      : "bg-slate-50 text-slate-300 border-slate-100"
                                  }`}
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                </span>

                                {/* Puntualidad */}
                                <span 
                                  title={record?.punctualidad ? "Puntualidad: Sí" : "Puntualidad: No"}
                                  className={`p-1 rounded-md border flex items-center justify-center transition-all ${
                                    record?.asistencia && record?.punctualidad 
                                      ? "bg-pink-50 text-pink-600 border-pink-150" 
                                      : "bg-slate-50 text-slate-300 border-slate-100"
                                  }`}
                                >
                                  <Clock className="w-3.5 h-3.5" />
                                </span>

                                {/* Biblia */}
                                <span 
                                  title={record?.biblia ? "Trajo Biblia: Sí" : "Trajo Biblia: No"}
                                  className={`p-1 rounded-md border flex items-center justify-center transition-all ${
                                    record?.asistencia && record?.biblia 
                                      ? "bg-emerald-50 text-emerald-600 border-emerald-150" 
                                      : "bg-slate-50 text-slate-300 border-slate-100"
                                  }`}
                                >
                                  <BookOpen className="w-3.5 h-3.5" />
                                </span>

                                {/* Participación */}
                                <span 
                                  title={record?.participacion ? "Participación: Sí" : "Participación: No"}
                                  className={`p-1 rounded-md border flex items-center justify-center transition-all ${
                                    record?.asistencia && record?.participacion 
                                      ? "bg-amber-50 text-amber-600 border-amber-150" 
                                      : "bg-slate-50 text-slate-300 border-slate-100"
                                  }`}
                                >
                                  <Star className="w-3.5 h-3.5" />
                                </span>

                                {/* Versículo */}
                                <span 
                                  title={record?.versiculo ? "Versículo Memorizado: Sí" : "Versículo Memorizado: No"}
                                  className={`p-1 rounded-md border flex items-center justify-center transition-all ${
                                    record?.asistencia && record?.versiculo 
                                      ? "bg-purple-50 text-purple-600 border-purple-150" 
                                      : "bg-slate-50 text-slate-300 border-slate-100"
                                  }`}
                                >
                                  <Brain className="w-3.5 h-3.5" />
                                </span>

                                {/* Visitas */}
                                {record?.asistencia && (record?.visitas ?? 0) > 0 && (
                                  <span 
                                    title={`Visitas traídas: ${record.visitas}`}
                                    className="px-1.5 py-0.5 rounded border flex items-center gap-0.5 bg-sky-50 text-sky-600 border-sky-150 font-mono text-[10px] font-bold animate-pulse-subtle"
                                  >
                                    <UserPlus className="w-3 h-3" />
                                    <span>+{record.visitas}</span>
                                  </span>
                                )}

                                {/* Puntos Extras */}
                                {record?.asistencia && (record?.puntosExtras ?? 0) !== 0 && (
                                  <span 
                                    title={`Puntos extra: ${record.puntosExtras}`}
                                    className={`px-1.5 py-0.5 rounded border flex items-center gap-0.5 font-mono text-[10px] font-bold ${
                                      record.puntosExtras > 0 
                                        ? "bg-amber-50 text-amber-700 border-amber-150" 
                                        : "bg-rose-50 text-rose-600 border-rose-150"
                                    }`}
                                  >
                                    <Sparkles className="w-3 h-3" />
                                    <span>{record.puntosExtras > 0 ? `+${record.puntosExtras}` : record.puntosExtras}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2.5">
                            <div className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-2 text-center min-w-[46px] sm:min-w-[50px] shadow-2xs">
                              <p className="font-mono font-bold text-base text-slate-805 leading-none">{ptsToday}</p>
                              <p className="text-[10px] text-indigo-605 font-bold mt-1 leading-none">pts</p>
                            </div>

                            {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                          </div>
                        </div>

                        {/* Accordion Extended Panel */}
                        {isExpanded && (
                          <div className="bg-white p-2.5 border-t border-slate-200/80 space-y-2.5">
                            
                            {/* Line 1: Quick Toggles (Grid of 5 columns) */}
                            <div className="grid grid-cols-5 gap-1.5">
                              {/* Asistencia Toggle */}
                              <motion.button
                                whileTap={{ scale: 0.92 }}
                                whileHover={{ scale: 1.02 }}
                                animate={{ scale: record?.asistencia ? [1, 1.08, 1] : [1, 0.96, 1] }}
                                transition={{ type: "tween", duration: 0.22, ease: "easeInOut" }}
                                onClick={() => handleFieldChange(student.id, registroDate, 'asistencia', !record?.asistencia)}
                                className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-center transition-all cursor-pointer ${
                                  record?.asistencia 
                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-inner font-bold' 
                                    : 'bg-slate-50 text-slate-450 border-slate-200 hover:bg-slate-100/50'
                                }`}
                              >
                                <span className="text-base">👥</span>
                                <span className="text-[11px] font-bold mt-1 tracking-tight truncate w-full">Asis.</span>
                              </motion.button>

                              {/* Rest of items checkable under assistance */}
                              {([
                                { label: 'Punt.', field: 'puntualidad', emoji: '⏰' },
                                { label: 'Bibl.', field: 'biblia', emoji: '📖' },
                                { label: 'Part.', field: 'participacion', emoji: '⭐' },
                                { label: 'Vers.', field: 'versiculo', emoji: '🧠' },
                              ] as const).map(item => {
                                const active = !!record?.[item.field];
                                return (
                                  <motion.button
                                    key={item.field}
                                    whileTap={{ scale: 0.92 }}
                                    whileHover={{ scale: 1.02 }}
                                    animate={{ scale: active ? [1, 1.08, 1] : [1, 0.96, 1] }}
                                    transition={{ type: "tween", duration: 0.22, ease: "easeInOut" }}
                                    onClick={() => handleFieldChange(student.id, registroDate, item.field, !active)}
                                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-center transition-all cursor-pointer ${
                                      active 
                                        ? 'bg-sky-50 text-sky-700 border-sky-200 shadow-inner font-bold' 
                                        : 'bg-slate-50 text-slate-450 border-slate-200 hover:bg-slate-100/50'
                                    }`}
                                  >
                                    <span className="text-base">{item.emoji}</span>
                                    <span className="text-[11px] font-bold mt-1 tracking-tight truncate w-full">{item.label}</span>
                                  </motion.button>
                                );
                              })}
                            </div>

                            {/* Line 2: Numeric Controllers (Single horizontal row) */}
                            <div className="flex items-center justify-between gap-3 bg-slate-50 p-1.5 rounded-xl border border-slate-200 w-full text-xs">
                              {/* Visitas Stepper */}
                              <div className="flex items-center justify-between flex-1 px-1.5">
                                <span className="text-xs font-bold text-slate-700">Visitas</span>
                                <div className="flex items-center space-x-1.5">
                                  <button 
                                    disabled={!record?.visitas}
                                    onClick={() => handleFieldChange(student.id, registroDate, 'visitas', Math.max(0, (record?.visitas || 0) - 1))}
                                    className="w-7 h-7 rounded-lg bg-white flex items-center justify-center border border-slate-200 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40 shadow-xs cursor-pointer"
                                  >
                                    <Minus className="w-3.5 h-3.5 text-slate-600" />
                                  </button>
                                  <span className="font-mono font-bold text-sm text-slate-800 min-w-[14px] text-center">{record?.visitas || 0}</span>
                                  <button 
                                    onClick={() => handleFieldChange(student.id, registroDate, 'visitas', (record?.visitas || 0) + 1)}
                                    className="w-7 h-7 rounded-lg bg-white flex items-center justify-center border border-slate-200 hover:bg-slate-50 active:bg-slate-100 shadow-xs cursor-pointer"
                                  >
                                    <Plus className="w-3.5 h-3.5 text-slate-600" />
                                  </button>
                                </div>
                              </div>

                              <div className="w-px h-6 bg-slate-200 shrink-0" />

                              {/* Puntos Extras */}
                              <div className="flex items-center justify-between flex-1 px-1.5">
                                <span className="text-xs font-bold text-slate-700">Extras</span>
                                <div className="flex items-center space-x-1.5">
                                  <button 
                                    onClick={() => handleFieldChange(student.id, registroDate, 'puntosExtras', (record?.puntosExtras || 0) - 1)}
                                    className="w-7 h-7 rounded-lg bg-white flex items-center justify-center border border-slate-200 hover:bg-slate-50 active:bg-slate-100 shadow-xs cursor-pointer"
                                  >
                                    <Minus className="w-3.5 h-3.5 text-slate-600" />
                                  </button>
                                  <span className={`font-mono font-bold text-sm min-w-[16px] text-center ${
                                    (record?.puntosExtras || 0) > 0 ? 'text-emerald-650' : (record?.puntosExtras || 0) < 0 ? 'text-rose-600' : 'text-slate-500'
                                  }`}>
                                    {(record?.puntosExtras || 0) > 0 ? `+${record?.puntosExtras}` : record?.puntosExtras || 0}
                                  </span>
                                  <button 
                                    onClick={() => handleFieldChange(student.id, registroDate, 'puntosExtras', (record?.puntosExtras || 0) + 1)}
                                    className="w-7 h-7 rounded-lg bg-white flex items-center justify-center border border-slate-200 hover:bg-slate-50 active:bg-slate-100 shadow-xs cursor-pointer"
                                  >
                                    <Plus className="w-3.5 h-3.5 text-slate-600" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {filteredStudents.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                      <Users className="w-8 h-8 mx-auto mb-2 stroke-1" />
                      <p className="text-xs">No hay estudiantes que coincidan con la búsqueda.</p>
                    </div>
                  )}
                </div>
              ) : (
                /* --- MODE TABLE CELL GRIDS --- */
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div className="overflow-x-auto animate-fade-in">
                  <table className="w-full text-left text-[13px] sm:text-sm text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700 font-sans tracking-tight">
                      <tr>
                        <th className="py-3 px-3.5 min-w-[120px] font-bold text-sm">Alum.</th>
                        <th className="py-3 px-2 text-center font-bold text-sm">Asis.</th>
                        <th className="py-3 px-2 text-center font-bold text-sm">Punt.</th>
                        <th className="py-3 px-2 text-center font-bold text-sm">Bibl.</th>
                        <th className="py-3 px-2 text-center font-bold text-sm">Part.</th>
                        <th className="py-3 px-2 text-center font-bold text-sm">Vers.</th>
                        <th className="py-3 px-2 text-center font-bold text-sm">Vis.</th>
                        <th className="py-3 px-2 text-center font-bold text-sm">Ext.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-700">
                      {filteredStudents.map(student => {
                        const record = records.find(r => r.studentId === student.id && r.date === registroDate);
                        return (
                          <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-3.5 px-3.5 font-medium">
                              <p className="font-display font-bold text-[14px] sm:text-base text-slate-900 leading-tight">
                                {student.name.split(' ')[0]} {student.name.split(' ')[1] || ''}
                              </p>
                            </td>
                            {/* Checkbox inputs with standard triggers */}
                            <td className="py-3 px-2 text-center">
                              <input 
                                type="checkbox" 
                                checked={!!record?.asistencia}
                                onChange={(e) => handleFieldChange(student.id, registroDate, 'asistencia', e.target.checked)}
                                className="w-5.5 h-5.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 pointer-events-auto cursor-pointer accent-indigo-600 shadow-xs"
                              />
                            </td>
                            <td className="py-3 px-2 text-center">
                              <input 
                                type="checkbox" 
                                checked={!!record?.puntualidad}
                                onChange={(e) => handleFieldChange(student.id, registroDate, 'puntualidad', e.target.checked)}
                                className="w-5.5 h-5.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600 shadow-xs"
                              />
                            </td>
                            <td className="py-3 px-2 text-center">
                              <input 
                                type="checkbox" 
                                checked={!!record?.biblia}
                                onChange={(e) => handleFieldChange(student.id, registroDate, 'biblia', e.target.checked)}
                                className="w-5.5 h-5.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600 shadow-xs"
                              />
                            </td>
                            <td className="py-3 px-2 text-center">
                              <input 
                                type="checkbox" 
                                checked={!!record?.participacion}
                                onChange={(e) => handleFieldChange(student.id, registroDate, 'participacion', e.target.checked)}
                                className="w-5.5 h-5.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600 shadow-xs"
                              />
                            </td>
                            <td className="py-3 px-2 text-center">
                              <input 
                                type="checkbox" 
                                checked={!!record?.versiculo}
                                onChange={(e) => handleFieldChange(student.id, registroDate, 'versiculo', e.target.checked)}
                                className="w-5.5 h-5.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-505 cursor-pointer accent-indigo-600 shadow-xs"
                              />
                            </td>
                            <td className="py-3 px-2 text-center">
                              <input 
                                type="text"
                                inputMode="numeric"
                                pattern="-?[0-9]*"
                                value={record?.visitas === undefined ? '' : record.visitas}
                                placeholder="0"
                                onFocus={(e) => {
                                  e.target.select();
                                  if (record?.visitas === 0) {
                                    handleFieldChange(student.id, registroDate, 'visitas', '');
                                  }
                                }}
                                onBlur={(e) => {
                                  if (e.target.value === '' || isNaN(parseInt(e.target.value))) {
                                    handleFieldChange(student.id, registroDate, 'visitas', 0);
                                  }
                                }}
                                onChange={(e) => {
                                  const valStr = e.target.value;
                                  if (valStr === '') {
                                    handleFieldChange(student.id, registroDate, 'visitas', '');
                                    return;
                                  }
                                  const val = parseInt(valStr);
                                  if (!isNaN(val)) {
                                    handleFieldChange(student.id, registroDate, 'visitas', val);
                                  }
                                }}
                                className="w-12 text-center bg-slate-50 text-slate-800 font-bold p-1.5 rounded-lg outline-none border border-slate-200 text-sm focus:ring-1 focus:ring-indigo-150"
                              />
                            </td>
                            <td className="py-3 px-2 text-center">
                              <input 
                                type="text"
                                inputMode="numeric"
                                pattern="-?[0-9]*"
                                value={record?.puntosExtras === undefined ? '' : record.puntosExtras}
                                placeholder="0"
                                onFocus={(e) => {
                                  e.target.select();
                                  if (record?.puntosExtras === 0) {
                                    handleFieldChange(student.id, registroDate, 'puntosExtras', '');
                                  }
                                }}
                                onBlur={(e) => {
                                  if (e.target.value === '' || isNaN(parseInt(e.target.value))) {
                                    handleFieldChange(student.id, registroDate, 'puntosExtras', 0);
                                  }
                                }}
                                onChange={(e) => {
                                  const valStr = e.target.value;
                                  if (valStr === '') {
                                    handleFieldChange(student.id, registroDate, 'puntosExtras', '');
                                    return;
                                  }
                                  const val = parseInt(valStr);
                                  if (!isNaN(val)) {
                                    handleFieldChange(student.id, registroDate, 'puntosExtras', val);
                                  }
                                }}
                                className="w-12 text-center bg-slate-50 text-slate-800 font-bold p-1.5 rounded-lg outline-none border border-slate-200 text-sm focus:ring-1 focus:ring-indigo-150"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            </div>
          </div>
        )}

        {/* --- VIEW: RANKING (Tab 2) --- */}
        {activeTab === 'ranking' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fade-in">
            
            {/* Rule Explanations Left Column (4 of 12 cols) - Sticky Title on Mobile */}
            <div className="lg:col-span-4 sticky top-[38px] bg-[#0F1626]/95 text-white backdrop-blur-sm rounded-xl px-3 py-1.5 border border-slate-800 shadow-md flex items-center justify-between self-start z-30">
              <div className="flex items-center space-x-2">
                <Crown className="w-4 h-4 text-amber-500 shrink-0 fill-amber-500/10" />
                <h3 className="font-display font-bold text-xs sm:text-sm text-white tracking-tight">Tabla de Posiciones</h3>
              </div>
              <p className="text-[11px] sm:text-xs text-[#4CC9F0] font-bold tracking-wider shrink-0 bg-[#4CC9F0]/10 border border-[#4CC9F0]/30 px-2.5 py-0.5 rounded-lg">
                {activePeriod?.name || 'Todo el Semestre'}
              </p>
            </div>

            {/* Top Rank Items Right Column (8 of 12 cols) */}
            <div className="lg:col-span-8 space-y-2.5">
              {leaderboardData.map((student, index) => {
                const isPodium = index < 3;
                const score = student.points;

                const bgColors = [
                  'bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 border-amber-600 text-amber-950 font-black shadow-md shadow-amber-200/50 text-xs sm:text-sm', // 1st Place (Oro)
                  'bg-gradient-to-br from-slate-200 via-slate-300 to-slate-500 border-slate-400 text-slate-800 font-black shadow-md shadow-slate-200/50 text-xs sm:text-sm', // 2nd Place (Plata)
                  'bg-gradient-to-br from-orange-600 via-orange-700 to-orange-900 border-orange-950 text-white font-black shadow-md shadow-orange-200/40 text-xs sm:text-sm' // 3rd Place (Bronce)
                ];

                return (
                  <div 
                    key={student.id}
                    className={`rounded-2xl p-3.5 flex items-center justify-between shadow-xs border ${
                      isPodium 
                        ? index === 0 
                          ? 'border-slate-200 border-l-4 border-l-amber-500 bg-amber-50/15' 
                          : index === 1 
                            ? 'border-slate-200 border-l-4 border-l-slate-400 bg-slate-50/15' 
                            : 'border-slate-200 border-l-4 border-l-orange-600 bg-orange-50/15'
                        : 'border-slate-200 bg-white hover:bg-slate-50/40'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      {/* Place Medal Badge */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-mono border shadow-xs ${
                        isPodium ? bgColors[index] : 'bg-slate-100 border-slate-200 text-slate-550 font-bold text-xs'
                      }`}>
                        {index + 1}
                      </div>

                      {/* Photo or Init */}
                      {student.photo ? (
                        <img src={student.photo} alt={student.name} referrerPolicy="no-referrer" className={`w-10 h-10 rounded-full object-cover shadow-xs border-2 ${student.gender === 'M' ? 'border-sky-300' : 'border-rose-300'}`} />
                      ) : (
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 ${student.gender === 'M' ? 'bg-sky-50 text-sky-600 border-sky-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
                          {student.name.charAt(0)}
                        </div>
                      )}

                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-900 text-[14px] sm:text-base leading-tight flex items-center space-x-1.5">
                          <span>{student.name}</span>
                          {index === 0 && <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                        </h4>
                        <p className="text-[10px] text-slate-450 font-mono tracking-wide mt-0.5 font-bold opacity-80">{student.gender === 'M' ? 'HOMBRE' : 'MUJER'}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="font-mono font-bold text-base text-slate-800 leading-none">{score}</p>
                      <p className="text-[8px] uppercase tracking-wider text-slate-400 mt-1 leading-none font-bold">puntos</p>
                    </div>
                  </div>
                );
              })}

              {leaderboardData.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <Award className="w-8 h-8 mx-auto mb-2 stroke-1" />
                  <p className="text-xs">No hay registros de puntos en este periodo.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- VIEW: ALUMNOS (Tab 3) --- */}
        {activeTab === 'alumnos' && (
          <div className="space-y-2.5 max-w-4xl mx-auto w-full animate-fade-in">
            {/* Sticky Title and Filter Block together so they remain fixed on scroll */}
            <div className="sticky top-[38px] z-30 bg-[#F8FAFC]/95 backdrop-blur-sm py-1.5 border-b border-slate-200/80 mb-1.5 animate-fade-in space-y-1.5 pb-2">
              <div className="flex justify-between items-center bg-[#0F1626]/95 border border-slate-800 rounded-xl px-3.5 py-1.5 shadow-md text-white">
                <h3 className="font-display font-bold text-xs sm:text-sm text-white">Directorio de Alumnos</h3>
                <span className="text-[10px] sm:text-xs text-[#4CC9F0] font-bold shrink-0 bg-[#4CC9F0]/10 border border-[#4CC9F0]/30 px-2.5 py-0.5 rounded-lg">
                  {filteredStudents.length} alum.
                </span>
              </div>

              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center">
                    <Search className="h-4.5 w-4.5 text-slate-400" />
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar alumno..."
                    className="block w-full pl-10 pr-8 py-2.5 border border-slate-200 rounded-xl text-sm bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-150 font-medium transition-all shadow-xs"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-3.5 flex items-center">
                      <X className="w-4.5 h-4.5 text-slate-400 hover:text-slate-650" />
                    </button>
                  )}
                </div>

                <div className="flex border border-slate-200 rounded-xl bg-white p-1 shadow-xs shrink-0">
                  {(['Todos', 'M', 'F'] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => setGenderFilter(g)}
                      title={g === 'Todos' ? 'Todos' : g === 'M' ? 'Hombres' : 'Mujeres'}
                      className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center min-w-[38px] ${
                        genderFilter === g 
                          ? 'bg-indigo-50 text-indigo-650 border border-indigo-150 font-bold shadow-xs' 
                          : 'text-slate-400 hover:text-slate-650'
                      }`}
                    >
                      {g === 'Todos' ? <Users className="w-4 h-4" /> : g === 'M' ? 'H' : 'M'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Responsive grid of cards for students */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {filteredStudents.map(student => {
                const totalPoints = studentScoresMap[student.id] || 0;
                return (
                  <div 
                    key={student.id}
                    className="bg-white hover:bg-slate-50/50 rounded-2xl p-2.5 sm:p-3 flex items-center justify-between shadow-2xs border border-slate-200 transition-colors"
                  >
                    <div className="flex items-center space-x-3.5">
                      {student.photo ? (
                        <img src={student.photo} alt={student.name} referrerPolicy="no-referrer" className={`w-10 h-10 rounded-full object-cover shadow-xs shrink-0 border-2 ${student.gender === 'M' ? 'border-sky-300' : 'border-rose-300'}`} />
                      ) : (
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border-2 ${student.gender === 'M' ? 'bg-sky-50 text-sky-600 border-sky-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
                          {student.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <h4 className="font-bold text-slate-900 text-[14px] sm:text-base leading-tight">{student.name}</h4>
                        <p className="text-xs text-slate-500 font-mono tracking-wide mt-1">{getAge(student.birthDate)} • {student.gender === 'M' ? 'Hombre' : 'Mujer'}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 shrink-0">
                      <button 
                        onClick={() => handleEditStudentClick(student)}
                        className="text-slate-400 hover:text-indigo-600 hover:bg-slate-100 p-1.5 rounded-lg transition-all cursor-pointer"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setDeleteTarget({ type: 'student', id: student.id, name: student.name })}
                        className="text-slate-400 hover:text-rose-600 hover:bg-rose-105 p-1.5 rounded-lg transition-all cursor-pointer"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredStudents.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <User className="w-8 h-8 mx-auto mb-2 stroke-1" />
                  <p className="text-xs">No hay estudiantes cargados en el directorio.</p>
                </div>
              )}
            </div>

            {/* FAB button floating below on the right */}
            <button 
              type="button"
              onClick={() => {
                setEditingStudent(null);
                setNewStudentName('');
                setNewStudentPhoto('');
                setNewStudentInitialPoints('');
                setIsStudentModalOpen(true);
              }}
              className="fixed bottom-20 right-5 z-40 bg-indigo-600 hover:bg-indigo-755 active:scale-95 text-white rounded-full w-14 h-14 hover:scale-105 flex items-center justify-center transition-all shadow-xl cursor-pointer border border-indigo-500"
              title="Añadir Alumno"
            >
              <UserPlus className="w-6 h-6 text-white" />
            </button>
          </div>
        )}

        {/* --- VIEW: CONFIGURACIÓN CELL (Tab 4) --- */}
        {activeTab === 'config' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start max-w-4xl mx-auto w-full animate-fade-in">
            
            {/* Academic Periods Manager list */}
            <div className="bg-white rounded-xl p-4 sm:p-5 shadow-2xs border border-slate-200/80 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4.5 h-4.5 text-indigo-600" />
                  <h3 className="font-display font-bold text-sm sm:text-base text-slate-900">Periodos</h3>
                </div>
                <button
                  onClick={() => {
                    setEditingPeriod(null);
                    setNewPeriodName('');
                    setNewPeriodStart('');
                    setNewPeriodEnd('');
                    setIsPeriodModalOpen(true);
                  }}
                  className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100/60 rounded-xl px-3 py-1.5 transition-colors flex items-center space-x-1 outline-none font-bold text-xs sm:text-sm border border-indigo-150 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-indigo-600" />
                  <span>Añadir</span>
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {periods.map(p => {
                  const isActive = activePeriod?.id === p.id;
                  return (
                    <div key={p.id} className="py-3 flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                           <p className="text-sm sm:text-base font-bold text-slate-800">{p.name}</p>
                          {isActive && (
                            <span className="bg-indigo-50 text-indigo-600 border border-indigo-150 text-[10px] sm:text-xs uppercase tracking-wide px-2 py-0.5 rounded-full font-bold">
                              Activo
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-slate-500 font-mono font-medium">
                          {p.startDate} al {p.endDate}
                        </p>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          onClick={() => handleEditPeriodClick(p)}
                          className="text-slate-400 hover:text-indigo-600 active:bg-slate-50 p-2 rounded-lg transition-all cursor-pointer"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget({ type: 'period', id: p.id, name: p.name })}
                          className="text-slate-400 hover:text-rose-600 active:bg-slate-50 p-2 rounded-lg transition-all cursor-pointer"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {periods.length === 0 && (
                  <p className="text-center py-8 text-slate-400 text-sm font-semibold">No hay periodos creados aún.</p>
                )}
              </div>
            </div>

            {/* Syncing Classroom ID code */}
            <div className="bg-white rounded-xl p-4 sm:p-5 shadow-2xs border border-slate-200/80 space-y-3.5">
              <div className="flex items-center space-x-2">
                <Settings className="w-4.5 h-4.5 text-indigo-600" />
                <h3 className="font-display font-bold text-sm sm:text-base text-slate-900">Código de Clase Activo</h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                Comparte este código con otros dispositivos para sincronizar de forma bidireccional los informes de asistencia de los estudiantes.
              </p>
              <div className="flex space-x-2 pt-1">
                <input
                  type="text"
                  value={classCode}
                  onChange={(e) => {
                    const clean = e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '');
                    setClassCode(clean);
                    localStorage.setItem('classCode', clean);
                  }}
                  placeholder="CÓDIGO_CLASE"
                  className="bg-slate-50 font-mono text-slate-800 text-sm sm:text-base font-bold rounded-xl px-4 py-2 border border-slate-200 outline-none uppercase flex-1 focus:ring-1 focus:ring-indigo-150 shadow-inner"
                />
              </div>
            </div>

          </div>
        )}

      </main>

      {/* --- ADD / EDIT STUDENT MODAL OVERLAY --- */}
      {isStudentModalOpen && (
        <div className="fixed inset-0 bg-[#060910]/85 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-xs">
          <div className="bg-[#0F1626] rounded-3xl max-w-sm w-full p-5 overflow-y-auto max-h-[90vh] shadow-2xl border border-slate-800">
            <div className="flex justify-between items-center pb-3 border-b border-indigo-500/10">
              <h3 className="font-display font-bold text-white text-base">
                {editingStudent ? 'Editar Alumno' : 'Nuevo Alumno'}
              </h3>
              <button onClick={() => setIsStudentModalOpen(false)} className="bg-slate-950 hover:bg-slate-900/50 text-slate-400 border border-slate-800 rounded-full p-1.5 cursor-pointer transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStudentSubmit} className="space-y-4 pt-3 text-slate-300">
              {/* Profile Image upload trigger section */}
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="relative w-24 h-24 rounded-full overflow-hidden bg-slate-950 border-2 border-slate-800 shadow-inner flex items-center justify-center group cursor-pointer">
                  {newStudentPhoto ? (
                    <img src={newStudentPhoto} alt="Upload Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-8 h-8 text-slate-450 group-hover:scale-110 transition-transform" />
                  )}
                  <input
                    type="file"
                     accept="image/*"
                    onChange={handlePhotoUpload}
                    className="absolute inset-x-0 top-0 bottom-0 opacity-0 cursor-pointer"
                  />
                </div>
                <span className="text-[11px] text-slate-450 font-semibold">Cargar foto (comprime a 250px)</span>
              </div>

              {/* Text Fields */}
              <div className="space-y-1">
                <label className="text-xs sm:text-xs font-bold text-[#4CC9F0] uppercase tracking-wide">Nombre Completo</label>
                <input
                  type="text"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  placeholder="ej. Mateo Fernández"
                  required
                  className="w-full bg-slate-950 rounded-xl px-3.5 py-2.5 border border-slate-800 outline-none text-slate-100 placeholder-slate-500 text-sm focus:ring-2 focus:ring-[#4CC9F0]/60 font-medium"
                />
              </div>

              {/* Sex selection buttons */}
              <div className="space-y-1">
                <label className="text-xs sm:text-xs font-bold text-[#4CC9F0] uppercase tracking-wide">Sexo</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewStudentGender('M')}
                    className={`py-2.5 px-3 rounded-xl border text-sm font-bold transition-all cursor-pointer ${
                      newStudentGender === 'M' 
                        ? 'bg-sky-500/20 border-sky-500/60 text-sky-300 ring-2 ring-sky-500/20' 
                        : 'bg-slate-950 border-slate-800 text-slate-400 font-semibold'
                    }`}
                  >
                    Hombre
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewStudentGender('F')}
                    className={`py-2.5 px-3 rounded-xl border text-sm font-bold transition-all cursor-pointer ${
                      newStudentGender === 'F' 
                        ? 'bg-pink-500/20 border-pink-500/60 text-pink-300 ring-2 ring-pink-500/20' 
                        : 'bg-slate-950 border-slate-800 text-slate-400 font-semibold'
                    }`}
                  >
                    Mujer
                  </button>
                </div>
              </div>

              {/* Birthdate dropdown */}
              <div className="space-y-1">
                <label className="text-xs sm:text-xs font-bold text-[#4CC9F0] uppercase tracking-wide">Fecha de Nacimiento</label>
                <input
                  type="date"
                  value={newStudentBirthDate}
                  onChange={(e) => setNewStudentBirthDate(e.target.value)}
                  className="w-full bg-slate-950 rounded-xl px-3.5 py-2.5 border border-slate-800 outline-none text-slate-100 text-sm focus:ring-2 focus:ring-[#4CC9F0]/60 cursor-pointer font-medium"
                />
              </div>

              {/* Migration Initial Score setup (only for additions) */}
              {!editingStudent && (
                <div className="space-y-1">
                  <label className="text-xs sm:text-xs font-bold text-[#4CC9F0] uppercase flex justify-between tracking-wide">
                    <span>Puntos Iniciales</span>
                    <span className="text-[10px] sm:text-[11px] text-[#2EC4B6] normal-case font-bold">MIGRE REGISTROS</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={newStudentInitialPoints}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setNewStudentInitialPoints(val === '' ? '' : parseInt(val, 10));
                    }}
                    placeholder="Puntos acumulados históricos"
                    className="w-full bg-slate-950 rounded-xl px-3.5 py-2.5 border border-slate-800 outline-none text-slate-100 placeholder-slate-500 text-sm focus:ring-2 focus:ring-[#4CC9F0]/60 font-medium"
                  />
                </div>
              )}

              {/* CTA triggers */}
              <div className="flex space-x-2 pt-2 border-t border-indigo-500/10">
                <button
                  type="button"
                  onClick={() => setIsStudentModalOpen(false)}
                  className="py-3 rounded-xl border border-slate-800 text-slate-400 text-sm font-bold flex-1 bg-slate-950/50 hover:text-white cursor-pointer active:bg-slate-950"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold flex-1 shadow-md transition-colors cursor-pointer"
                >
                  {editingStudent ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD PERIOD MODAL OVERLAY --- */}
      {isPeriodModalOpen && (
        <div className="fixed inset-0 bg-[#060910]/85 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-xs">
          <div className="bg-[#0F1626] rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-800">
            <div className="flex justify-between items-center pb-3 border-b border-indigo-500/10">
              <h3 className="font-display font-bold text-white text-base">
                {editingPeriod ? 'Editar Bimestre / Periodo' : 'Nuevo Bimestre / Periodo'}
              </h3>
              <button onClick={() => setIsPeriodModalOpen(false)} className="bg-slate-950 hover:bg-slate-900/50 text-slate-400 border border-slate-800 rounded-full p-1.5 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePeriodSubmit} className="space-y-4 pt-3 text-slate-300">
              <div className="space-y-1">
                <label className="text-xs sm:text-xs font-bold text-[#4CC9F0] uppercase tracking-wide">Nombre del Periodo</label>
                <input
                  type="text"
                  required
                  value={newPeriodName}
                  onChange={(e) => setNewPeriodName(e.target.value)}
                  placeholder="ej. Tercer Bimestre de Memoria"
                  className="w-full bg-slate-950 rounded-xl px-3.5 py-2.5 border border-slate-800 outline-none text-slate-100 placeholder-slate-500 text-sm focus:ring-2 focus:ring-[#4CC9F0]/60 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs sm:text-xs font-bold text-[#4CC9F0] uppercase tracking-wide">Inicia</label>
                  <input
                    type="date"
                    required
                    value={newPeriodStart}
                    onChange={(e) => setNewPeriodStart(e.target.value)}
                    className="w-full bg-slate-950 rounded-xl px-3.5 py-2.5 border border-slate-800 outline-none text-slate-100 text-sm focus:ring-2 focus:ring-[#4CC9F0]/60 cursor-pointer font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs sm:text-xs font-bold text-[#4CC9F0] uppercase tracking-wide">Finaliza</label>
                  <input
                    type="date"
                    required
                    value={newPeriodEnd}
                    onChange={(e) => setNewPeriodEnd(e.target.value)}
                    className="w-full bg-slate-950 rounded-xl px-3.5 py-2.5 border border-slate-800 outline-none text-slate-100 text-sm focus:ring-2 focus:ring-[#4CC9F0]/60 cursor-pointer font-medium"
                  />
                </div>
              </div>

              <div className="flex space-x-2 pt-2 border-t border-indigo-500/10">
                <button
                  type="button"
                  onClick={() => setIsPeriodModalOpen(false)}
                  className="py-3 rounded-xl border border-slate-800 text-slate-400 text-sm font-bold flex-1 bg-slate-950/50 hover:text-white cursor-pointer select-none"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="py-3 rounded-xl bg-indigo-600 hover:bg-indigo-505 text-white text-sm font-bold flex-1 shadow-md transition-colors cursor-pointer"
                >
                  {editingPeriod ? 'Guardar Cambios' : 'Crear Periodo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- CUSTOM DELETE MODAL OVERLAY --- */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-[#060910]/85 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-xs">
          <div className="bg-[#0F1626] rounded-3xl max-w-sm w-full p-5 text-center shadow-2xl border border-slate-800 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400 animate-bounce">
              <Trash2 className="w-6 h-6" />
            </div>
            
            <div className="space-y-1">
              <h3 className="font-display font-bold text-white text-base">¿Estás seguro de eliminar?</h3>
              <p className="text-sm text-slate-300 px-3 leading-relaxed">
                Esta acción es irreversible. Se eliminará a <strong className="text-white font-bold">{deleteTarget.name}</strong> y todos sus datos o registros relacionados del sistema permanentemente.
              </p>
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="py-3 px-4 rounded-xl border border-slate-800 text-slate-400 text-sm font-bold flex-1 hover:text-white bg-slate-950/55 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (deleteTarget.type === 'student') {
                    await removeStudentAndLogs(deleteTarget.id);
                  } else {
                    await removePeriod(deleteTarget.id);
                  }
                  setDeleteTarget(null);
                }}
                className="py-3 px-4 rounded-xl bg-rose-600 text-white text-sm font-bold flex-1 hover:bg-rose-500 transition-colors shadow-md cursor-pointer"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- BOTTOM NAVIGATION BAR (FIXED) --- */}
      <nav className="fixed bottom-0 inset-x-0 z-45 bg-[#0F1626]/95 text-slate-300 backdrop-blur-md shadow-lg border-t border-slate-800 pb-safe">
        <div className="max-w-md mx-auto grid grid-cols-4 text-center text-[11px] sm:text-[12px] font-bold">
          {([
            { id: 'registro', label: 'Registro', icon: UserCheck },
            { id: 'ranking', label: 'Top 10', icon: Award },
            { id: 'alumnos', label: 'Alumnos', icon: Users },
            { id: 'config', label: 'Ajustes', icon: Settings },
          ] as const).map((tab) => {
            const isActive = activeTab === tab.id;
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-1.5 sm:py-2 flex flex-col items-center justify-center space-y-1 transition-all ${
                  isActive 
                    ? 'text-[#4CC9F0] bg-indigo-600/15 font-bold border-t-2 border-[#4CC9F0]' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <IconComponent className={`w-5 h-5 ${isActive ? 'scale-105 text-[#4CC9F0]' : 'text-slate-500'} transition-transform duration-150`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

    </div>
  );
}
