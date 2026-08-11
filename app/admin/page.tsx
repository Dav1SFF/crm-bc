"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2, CheckCircle, ShieldAlert, Activity, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { logAction } from "@/lib/logger";

interface ActionLog {
  id: string;
  user_name: string;
  action_type: string;
  entity_id: string;
  entity_name: string;
  details: any;
  created_at: string;
}

interface Dealership {
  id: string;
  name: string;
  category: string;
  phone: string;
  city: string;
  crm_type: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'logs' | 'deletions'>('logs');
  
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [pendingDeletions, setPendingDeletions] = useState<Dealership[]>([]);
  const [currentUser, setCurrentUser] = useState("");

  useEffect(() => {
    const authStatus = localStorage.getItem("crm_auth");
    const role = localStorage.getItem("crm_role");
    const user = localStorage.getItem("crm_user");
    
    if (authStatus !== "true" || role !== "SuperAdmin") {
      router.push("/");
    } else {
      if (user) setCurrentUser(user);
      fetchData();
    }
  }, [router]);

  const fetchData = async () => {
    setLoading(true);
    const [logsRes, delRes] = await Promise.all([
      supabase.from("action_logs").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("dealerships").select("id, name, category, phone, city, crm_type").eq("pending_deletion", true)
    ]);

    if (logsRes.data) setLogs(logsRes.data);
    if (delRes.data) setPendingDeletions(delRes.data);
    setLoading(false);
  };

  const handleApproveDelete = async (item: Dealership) => {
    if (confirm(`Точно УДАЛИТЬ НАВСЕГДА объект "${item.name}"?`)) {
      await supabase.from("dealerships").delete().eq("id", item.id);
      logAction(currentUser, 'HARD_DELETE', item.id, item.name);
      fetchData();
    }
  };

  const handleRejectDelete = async (item: Dealership) => {
    if (confirm(`Отклонить удаление и вернуть объект "${item.name}" в работу?`)) {
      await supabase.from("dealerships").update({ pending_deletion: false }).eq("id", item.id);
      logAction(currentUser, 'RESTORE', item.id, item.name);
      fetchData();
    }
  };

  const formatAction = (type: string) => {
    switch(type) {
      case 'LOGIN': return <span className="text-blue-600 font-semibold">Вход в систему</span>;
      case 'LOGOUT': return <span className="text-slate-500 font-semibold">Выход</span>;
      case 'PAGE_VISIT': return <span className="text-slate-400">Посещение страницы</span>;
      case 'CREATE_OBJECT': return <span className="text-green-600 font-semibold">Создание объекта</span>;
      case 'DELETE_REQUEST': return <span className="text-orange-600 font-semibold">Запрос на удаление</span>;
      case 'HARD_DELETE': return <span className="text-red-600 font-bold">Полное удаление</span>;
      case 'RESTORE': return <span className="text-emerald-600 font-semibold">Восстановление</span>;
      case 'UPDATE_STATUS': return <span className="text-purple-600 font-semibold">Смена статуса</span>;
      case 'ADD_COMMENT': return <span className="text-sky-600 font-semibold">Комментарий</span>;
      case 'ADD_REMINDER': return <span className="text-indigo-600 font-semibold">Напоминание</span>;
      case 'ADD_CITY': return <span className="text-teal-600 font-semibold">Новый город</span>;
      default: return <span>{type}</span>;
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Загрузка панели...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition">
              <ArrowLeft className="w-5 h-5 text-slate-700" />
            </Link>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-amber-600" /> 
              Админ-панель
            </h1>
          </div>
          
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${activeTab === "logs" ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-800"}`}
            >
              <Activity className="w-4 h-4" /> Логи действий
            </button>
            <button
              onClick={() => setActiveTab('deletions')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${activeTab === "deletions" ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-800"}`}
            >
              <AlertTriangle className="w-4 h-4" /> На удаление ({pendingDeletions.length})
            </button>
          </div>
        </header>

        {activeTab === 'logs' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Дата / Время</th>
                    <th className="px-6 py-4">Пользователь</th>
                    <th className="px-6 py-4">Действие</th>
                    <th className="px-6 py-4">Объект</th>
                    <th className="px-6 py-4">Детали</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400">
                        {new Date(log.created_at).toLocaleString('ru-RU')}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-800">
                        {log.user_name}
                      </td>
                      <td className="px-6 py-4">
                        {formatAction(log.action_type)}
                      </td>
                      <td className="px-6 py-4">
                        {log.entity_name ? (
                          <Link href={log.entity_id ? `/dealership/${log.entity_id}` : "#"} className="text-blue-600 hover:underline">
                            {log.entity_name}
                          </Link>
                        ) : "-"}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 max-w-xs truncate">
                        {log.details ? JSON.stringify(log.details) : "-"}
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">Нет логов</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'deletions' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pendingDeletions.map(item => (
              <div key={item.id} className="bg-white p-5 rounded-2xl shadow-sm border border-red-200 flex flex-col gap-4">
                <div>
                  <h3 className="font-bold text-lg text-slate-800 mb-1">{item.name}</h3>
                  <div className="flex gap-2 text-xs font-semibold">
                    <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded">{item.category}</span>
                    <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded">CRM: {item.crm_type === 'calls' ? 'Звонки' : 'Оффлайн'}</span>
                  </div>
                </div>
                
                <div className="flex gap-2 mt-auto">
                  <button onClick={() => handleApproveDelete(item)} className="flex-1 flex items-center justify-center gap-1 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-semibold rounded-xl text-sm transition">
                    <Trash2 className="w-4 h-4"/> Удалить
                  </button>
                  <button onClick={() => handleRejectDelete(item)} className="flex-1 flex items-center justify-center gap-1 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-semibold rounded-xl text-sm transition">
                    <CheckCircle className="w-4 h-4"/> Вернуть
                  </button>
                </div>
              </div>
            ))}
            {pendingDeletions.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-300" />
                <p>Нет запросов на удаление</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
