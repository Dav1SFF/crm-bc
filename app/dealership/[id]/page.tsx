"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, Phone, Calendar, User, 
  Car, Building2, Edit, Trash2, Send, Clock, MapPin, Globe, MessageSquare, Bell, UserPlus
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Status = "Новый" | "В работе" | "Сделка" | "Отказ";
type ReminderType = "Дзвінок" | "Зустріч" | "Повідомлення" | "Інше";

interface Comment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

interface Reminder {
  id: string;
  type: ReminderType;
  date: string;
  author: string;
  notified_3h?: boolean;
  notified_1h?: boolean;
  notified_15m?: boolean;
}

interface Dealership {
  id: string;
  name: string;
  category: string;
  phone: string;
  link: string;
  address: string;
  status: Status;
  notes?: string;
  city: string;
  created_at: string;
  comments?: Comment[];
  reminders?: Reminder[];
}

export default function DealershipPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<string>("User");
  
  const [item, setItem] = useState<Dealership | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Комментарии
  const [newComment, setNewComment] = useState("");
  
  // Напоминания
  const [reminderType, setReminderType] = useState<ReminderType>("Дзвінок");
  const [reminderDate, setReminderDate] = useState("");

  useEffect(() => {
    const authStatus = localStorage.getItem("crm_auth");
    const user = localStorage.getItem("crm_user");
    if (authStatus !== "true") {
      router.push("/");
    } else {
      setIsAuthenticated(true);
      if (user) setCurrentUser(user);
    }
  }, [router]);

  const fetchItem = async () => {
    const { data, error } = await supabase
      .from("dealerships")
      .select("*")
      .eq("id", id)
      .single();

    if (!error && data) {
      setItem({
        ...data,
        comments: data.comments || [],
        reminders: data.reminders || []
      } as Dealership);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!isAuthenticated || !id) return;
    
    fetchItem();

    const channel = supabase
      .channel(`realtime_dealership_${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dealerships", filter: `id=eq.${id}` },
        () => {
          fetchItem();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, id]);

  const handleStatusChange = async (newStatus: Status) => {
    if (!item) return;
    setItem({ ...item, status: newStatus });
    await supabase.from("dealerships").update({ status: newStatus }).eq("id", id);
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !item) return;

    const comment: Comment = {
      id: Date.now().toString(),
      author: currentUser,
      text: newComment.trim(),
      createdAt: new Date().toISOString()
    };

    const updatedComments = [...(item.comments || []), comment];
    setItem({ ...item, comments: updatedComments });
    setNewComment("");

    await supabase.from("dealerships").update({ comments: updatedComments }).eq("id", id);
  };

  const handleAddReminder = async () => {
    if (!reminderDate || !item) return;

    const reminder: Reminder = {
      id: Date.now().toString(),
      type: reminderType,
      date: new Date(reminderDate).toISOString(),
      author: currentUser,
      notified_3h: false,
      notified_1h: false,
      notified_15m: false
    };

    const updatedReminders = [...(item.reminders || []), reminder];
    setItem({ ...item, reminders: updatedReminders });
    
    await supabase.from("dealerships").update({ reminders: updatedReminders }).eq("id", id);
    alert("Напоминание успешно добавлено!");
    setReminderDate("");
  };

  if (!isAuthenticated || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 font-medium">Загрузка...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <p className="text-slate-500 font-medium text-lg">Объект не найден</p>
        <Link href="/" className="px-4 py-2 bg-blue-600 text-white rounded-xl font-medium">
          Вернуться на главную
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 uppercase flex items-center gap-3">
                {item.name}
                <span className="text-xs font-semibold px-2 py-1 bg-slate-200 text-slate-700 rounded-md normal-case">
                  {item.category}
                </span>
              </h1>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT COLUMN: Data & Description */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Данные клиента</h2>
              
              <div className="space-y-4">
                <div className="flex gap-3 items-start">
                  <div className="p-2 bg-slate-100 rounded-full text-slate-500"><User className="w-4 h-4"/></div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Имя / Название</p>
                    <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                  </div>
                </div>

                <div className="flex gap-3 items-start">
                  <div className="p-2 bg-slate-100 rounded-full text-slate-500"><Phone className="w-4 h-4"/></div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Телефон</p>
                    <a href={`tel:${item.phone}`} className="text-sm font-bold text-blue-600">{item.phone}</a>
                  </div>
                </div>

                <div className="flex gap-3 items-start">
                  <div className="p-2 bg-slate-100 rounded-full text-slate-500"><Calendar className="w-4 h-4"/></div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Создано</p>
                    <p className="text-sm font-medium text-slate-700">
                      {new Date(item.created_at).toLocaleString('ru-RU')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Описание
              </h2>
              
              <div className="space-y-3 text-sm text-slate-700">
                <p><strong>Адрес:</strong> {item.address}</p>
                <p><strong>Город:</strong> {item.city}</p>
                {item.link && item.link !== "-" && (
                  <p>
                    <strong>Ссылка:</strong> <a href={item.link.startsWith("http") ? item.link : `https://${item.link}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{item.link}</a>
                  </p>
                )}
                {item.notes && (
                  <div>
                    <strong className="block mb-1">Заметки:</strong>
                    <p className="bg-slate-50 p-3 rounded-xl border border-slate-100">{item.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CENTER COLUMN: Comments */}
          <div className="lg:col-span-6 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-[600px] lg:h-auto">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Комментарии и история
              </h2>
            </div>
            
            <div className="flex-1 p-5 overflow-y-auto space-y-4">
              {(item.comments || []).map(comment => (
                <div key={comment.id} className="flex flex-col gap-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-bold text-slate-800">{comment.author}</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(comment.createdAt).toLocaleString('ru-RU')}
                    </span>
                  </div>
                  <div className="bg-slate-100 p-3 rounded-2xl rounded-tl-sm text-sm text-slate-700 w-fit max-w-[90%]">
                    {comment.text}
                  </div>
                </div>
              ))}
              {(item.comments || []).length === 0 && (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                  Нет комментариев
                </div>
              )}
            </div>

            <div className="p-4 bg-white border-t border-slate-100 flex gap-2">
              <input
                type="text"
                placeholder="Введите комментарий..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button 
                onClick={handleAddComment}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2"
              >
                <Send className="w-4 h-4" /> Написать
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: Management & Reminders */}
          <div className="lg:col-span-3 space-y-6">
            
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-5">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Управление</h2>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Статус заявки</label>
                <select
                  value={item.status}
                  onChange={(e) => handleStatusChange(e.target.value as Status)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Новый">Новый</option>
                  <option value="В работе">В работе</option>
                  <option value="Сделка">Сделка</option>
                  <option value="Отказ">Отказ</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                  <Bell className="w-3 h-3" /> Добавить напоминание
                </label>
                
                <div className="space-y-3">
                  <select
                    value={reminderType}
                    onChange={(e) => setReminderType(e.target.value as ReminderType)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Дзвінок">📞 Звонок</option>
                    <option value="Зустріч">🤝 Встреча</option>
                    <option value="Повідомлення">✉️ Сообщение</option>
                    <option value="Інше">📌 Другое</option>
                  </select>

                  <input
                    type="datetime-local"
                    value={reminderDate}
                    onChange={(e) => setReminderDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  <button 
                    onClick={handleAddReminder}
                    className="w-full bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold py-2 rounded-xl transition shadow-sm"
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ответственные</h2>
                <button className="text-blue-600 hover:bg-blue-50 p-1 rounded-md transition text-xs font-medium flex items-center gap-1">
                  <UserPlus className="w-3 h-3" /> Добавить
                </button>
              </div>
              
              <div className="flex items-center gap-3 p-2 border border-slate-100 rounded-xl bg-slate-50">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                  {currentUser[0].toUpperCase()}
                </div>
                <span className="text-sm font-semibold text-slate-800">{currentUser}</span>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
