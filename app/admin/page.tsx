"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2, CheckCircle, ShieldAlert, Activity, AlertTriangle, Users, BarChart3, Plus } from "lucide-react";
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
  status: string;
  crm_type: string;
}

interface User {
  username: string;
  role: string;
  created_at: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'logs' | 'deletions' | 'users' | 'analytics'>('logs');
  
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [pendingDeletions, setPendingDeletions] = useState<Dealership[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [allDealerships, setAllDealerships] = useState<Dealership[]>([]);
  const [currentUser, setCurrentUser] = useState("");

  const [newUserForm, setNewUserForm] = useState({ username: "", password: "", role: "Manager" });

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
    const [logsRes, delRes, usersRes, dealRes] = await Promise.all([
      supabase.from("action_logs").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("dealerships").select("*").eq("pending_deletion", true),
      supabase.from("users").select("username, role, created_at").order("created_at"),
      supabase.from("dealerships").select("*")
    ]);

    if (logsRes.data) setLogs(logsRes.data);
    if (delRes.data) setPendingDeletions(delRes.data);
    if (usersRes.data) setUsers(usersRes.data);
    if (dealRes.data) setAllDealerships(dealRes.data);
    setLoading(false);
  };

  const handleApproveDelete = async (item: Dealership) => {
    if (confirm(`Точно УДАЛИТЬ НАВСЕГДА объект "${item.name}"?`)) {
      await supabase.from("dealerships").delete().eq("id", item.id);
      logAction(currentUser, 'HARD_DELETE', item.id, item.name);
      
      // Notify the person who requested it (maybe from logs, or just a general notification)
      // Since we don't know who requested it easily here, we'll skip targeted for this specific click or target Denis.
      // Better: we can assume Denis requested it, or log it globally.
      
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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const { username, password, role } = newUserForm;
    if (!username || !password) return;

    const { error } = await supabase.from('users').insert([{ username, password, role }]);
    if (error) {
      alert("Ошибка при создании пользователя: " + error.message);
    } else {
      alert("Пользователь успешно создан!");
      setNewUserForm({ username: "", password: "", role: "Manager" });
      fetchData();
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (username === 'Dispatcher') {
      alert("Нельзя удалить главного администратора!");
      return;
    }
    if (confirm(`Точно удалить пользователя ${username}?`)) {
      await supabase.from('users').delete().eq('username', username);
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

  // Analytics Computations
  const totalOffline = allDealerships.filter(d => d.crm_type === 'offline').length;
  const totalCalls = allDealerships.filter(d => d.crm_type === 'calls').length;
  
  const statusCounts = allDealerships.reduce((acc, curr) => {
    acc[curr.status] = (acc[curr.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const userActivity = logs.reduce((acc, curr) => {
    if (!['PAGE_VISIT', 'LOGIN', 'LOGOUT'].includes(curr.action_type)) {
      acc[curr.user_name] = (acc[curr.user_name] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

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
          
          <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl gap-1">
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${activeTab === "logs" ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-800"}`}
            >
              <Activity className="w-4 h-4" /> Логи
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${activeTab === "analytics" ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-800"}`}
            >
              <BarChart3 className="w-4 h-4" /> Аналитика
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${activeTab === "users" ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-800"}`}
            >
              <Users className="w-4 h-4" /> Сотрудники
            </button>
            <button
              onClick={() => setActiveTab('deletions')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${activeTab === "deletions" ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-800"}`}
            >
              <AlertTriangle className="w-4 h-4" /> Запросы на удаление ({pendingDeletions.length})
            </button>
          </div>
        </header>

        {activeTab === 'analytics' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Объекты в CRM</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="font-medium text-slate-600">Оффлайн (Встречи)</span>
                  <span className="text-xl font-bold text-slate-800">{totalOffline}</span>
                </div>
                <div className="flex justify-between items-center pb-2">
                  <span className="font-medium text-slate-600">Звонки (Холодные)</span>
                  <span className="text-xl font-bold text-slate-800">{totalCalls}</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Воронка (Статусы)</h3>
              <div className="space-y-3">
                {Object.entries(statusCounts).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${status === 'Новый' ? 'bg-blue-500' : status === 'В работе' ? 'bg-yellow-500' : status === 'Сделка' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className="text-sm font-medium text-slate-700">{status}</span>
                    </div>
                    <span className="font-bold text-slate-800">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Активность (Недавняя)</h3>
              <div className="space-y-3">
                {Object.entries(userActivity).map(([user, count]) => (
                  <div key={user} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                        {user.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-slate-700">{user}</span>
                    </div>
                    <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">{count} действий</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Логин</th>
                    <th className="px-6 py-4">Роль</th>
                    <th className="px-6 py-4">Дата создания</th>
                    <th className="px-6 py-4 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map(user => (
                    <tr key={user.username} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-bold text-slate-800 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        {user.username}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${user.role === 'SuperAdmin' ? 'bg-amber-100 text-amber-700' : user.role === 'Admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">
                        {new Date(user.created_at).toLocaleDateString('ru-RU')}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {user.username !== 'Dispatcher' && (
                          <button onClick={() => handleDeleteUser(user.username)} className="text-red-500 hover:text-red-700 p-1 transition">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit">
              <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600" />
                Новый сотрудник
              </h3>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Логин</label>
                  <input
                    type="text"
                    required
                    value={newUserForm.username}
                    onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Пароль</label>
                  <input
                    type="text"
                    required
                    value={newUserForm.password}
                    onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Роль</label>
                  <select
                    value={newUserForm.role}
                    onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="Manager">Менеджер (Ограниченный доступ)</option>
                    <option value="Admin">Админ (Полный доступ)</option>
                    <option value="SuperAdmin">SuperAdmin (С доступом к этой панели)</option>
                  </select>
                </div>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-xl text-sm transition">
                  Создать
                </button>
              </form>
            </div>
          </div>
        )}

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
