"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { 
  Plus, Search, Trash2, Edit, Phone, Globe, MapPin, 
  Car, Building2, CheckCircle, Clock, XCircle, AlertCircle, RefreshCw, 
  Map, Navigation, MessageSquare, Send, X, ShieldAlert, PhoneCall
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { logAction } from "@/lib/logger";

type Category = "Официальные автосалоны" | "Авторынки и площадки" | "Автовыкуп";
type Status = "Новый" | "В работе" | "Сделка" | "Отказ";
type City = "Белая Церковь" | "Киев";

interface Comment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

interface Dealership {
  id: string;
  name: string;
  category: Category;
  phone: string;
  link: string;
  address: string;
  status: Status;
  notes?: string;
  city: City;
  lat?: number;
  lng?: number;
  comments?: Comment[];
}

const CREDENTIALS = {
  "Dispatcher": { pass: "517707d1", role: "SuperAdmin" },
  "Max": { pass: "517707d2", role: "Admin" },
  "Denis": { pass: "517707d1", role: "Manager" }
};

const categoryMap: Record<string, string> = {
  "Офіційні автосалони": "Официальные автосалоны",
  "Авторинки та майданчики": "Авторынки и площадки",
  "Автовикуп": "Автовыкуп"
};

const statusMap: Record<string, string> = {
  "Новий": "Новый",
  "В роботі": "В работе",
  "Угода": "Сделка",
  "Відмова": "Отказ"
};

// Функция для расчета расстояния в километрах
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Радиус Земли в км
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  const d = R * c; 
  return d;
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("");
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");

  const [items, setItems] = useState<Dealership[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCrm, setActiveCrm] = useState<'offline' | 'calls'>('offline');
  const [dbCities, setDbCities] = useState<{name: string}[]>([]);
  
  // Фільтри
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Все");
  const [selectedStatus, setSelectedStatus] = useState<string>("Все");
  const [selectedCity, setSelectedCity] = useState<City>("Белая Церковь");
  
  // Геолокация
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Dealership | null>(null);

  // Состояние комментариев
  const [expandedCommentsId, setExpandedCommentsId] = useState<string | null>(null);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    category: "Официальные автосалоны" as Category,
    phone: "",
    link: "",
    address: "",
    status: "Новый" as Status,
    notes: "",
    city: "Белая Церковь" as City,
    coordinates: ""
  });

  useEffect(() => {
    const authStatus = localStorage.getItem("crm_auth");
    const user = localStorage.getItem("crm_user");
    const role = localStorage.getItem("crm_role");
    if (authStatus === "true") {
      setIsAuthenticated(true);
      if (user) setCurrentUser(user);
      if (role) setUserRole(role);
      
      // Логируем посещение
      if (user) logAction(user, 'PAGE_VISIT', undefined, undefined, { path: '/' });
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error("Error getting location: ", error);
        }
      );
    }
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const { username, password } = loginForm;
    const cred = CREDENTIALS[username as keyof typeof CREDENTIALS];
    if (cred && cred.pass === password) {
      setIsAuthenticated(true);
      setCurrentUser(username);
      setUserRole(cred.role);
      localStorage.setItem("crm_auth", "true");
      localStorage.setItem("crm_user", username);
      localStorage.setItem("crm_role", cred.role);
      setLoginError("");
      logAction(username, 'LOGIN');
    } else {
      setLoginError("Неверный логин или пароль");
    }
  };

  const handleLogout = () => {
    logAction(currentUser, 'LOGOUT');
    setIsAuthenticated(false);
    setCurrentUser("");
    setUserRole("");
    localStorage.removeItem("crm_auth");
    localStorage.removeItem("crm_user");
    localStorage.removeItem("crm_role");
  };

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("dealerships")
      .select("*")
      .eq("crm_type", activeCrm)
      .neq("pending_deletion", true)
      .order("created_at", { ascending: true });

    if (!error && data) {
      const translatedData = data.map(item => ({
        ...item,
        category: categoryMap[item.category] || item.category,
        status: statusMap[item.status] || item.status,
        city: item.city || "Белая Церковь", // Fallback если колонка пустая
        comments: item.comments || []
      }));
      setItems(translatedData as Dealership[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    
    fetchItems();
    if (activeCrm === 'calls') {
      supabase.from("cities").select("name").order("name").then(({data}) => {
        if (data) setDbCities(data);
      });
    }

    const channel = supabase
      .channel("realtime_dealerships")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dealerships" },
        () => {
          fetchItems();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, activeCrm]);

  const handleDelete = async (item: Dealership) => {
    if (userRole === "Manager") {
      if (confirm("Отправить запрос на удаление этого объекта главному администратору?")) {
        await supabase.from("dealerships").update({ pending_deletion: true }).eq("id", item.id);
        logAction(currentUser, 'DELETE_REQUEST', item.id, item.name);
        fetchItems();
      }
    } else {
      if (confirm("Вы уверены, что хотите удалить этот объект НАВСЕГДА?")) {
        await supabase.from("dealerships").delete().eq("id", item.id);
        logAction(currentUser, 'HARD_DELETE', item.id, item.name);
        fetchItems();
      }
    }
  };

  const handleStatusChange = async (id: string, name: string, newStatus: Status) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
    );
    await supabase.from("dealerships").update({ status: newStatus }).eq("id", id);
    logAction(currentUser, 'UPDATE_STATUS', id, name, { newStatus });
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      category: "Официальные автосалоны",
      phone: "",
      link: "",
      address: "",
      status: "Новый",
      notes: "",
      city: selectedCity,
      coordinates: ""
    });
    setIsModalOpen(true);
  };

  const openEditModal = (item: Dealership) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      phone: item.phone,
      link: item.link,
      address: item.address,
      status: item.status,
      notes: item.notes || "",
      city: item.city || "Белая Церковь",
      coordinates: (item.lat && item.lng) ? `${item.lat}, ${item.lng}` : ""
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let lat = null;
    let lng = null;
    if (formData.coordinates) {
      const parts = formData.coordinates.split(',');
      if (parts.length >= 2) {
        lat = parseFloat(parts[0].trim());
        lng = parseFloat(parts[1].trim());
      }
    }

    const payload = {
      name: formData.name,
      category: formData.category,
      phone: formData.phone,
      link: formData.link,
      address: formData.address,
      status: formData.status,
      notes: formData.notes,
      city: formData.city,
      lat,
      lng,
      crm_type: activeCrm
    };

    if (editingItem) {
      await supabase
        .from("dealerships")
        .update(payload)
        .eq("id", editingItem.id);
    } else {
      await supabase.from("dealerships").insert([payload]);
      logAction(currentUser, 'CREATE_OBJECT', undefined, payload.name, { crm_type: activeCrm });
    }
    setIsModalOpen(false);
    fetchItems();
  };

  // Comments Logic
  const handleAddComment = async (dealershipId: string) => {
    const text = commentInputs[dealershipId]?.trim();
    if (!text) return;

    const dealership = items.find(i => i.id === dealershipId);
    if (!dealership) return;

    const newComment: Comment = {
      id: Date.now().toString(),
      author: currentUser || "User",
      text,
      createdAt: new Date().toISOString()
    };

    const updatedComments = [...(dealership.comments || []), newComment];
    
    setItems(prev => prev.map(i => i.id === dealershipId ? { ...i, comments: updatedComments } : i));
    setCommentInputs(prev => ({ ...prev, [dealershipId]: "" }));

    await supabase.from("dealerships").update({ comments: updatedComments }).eq("id", dealershipId);
  };

  const handleEditComment = async (dealershipId: string, commentId: string) => {
    if (!editingCommentText.trim()) return;

    const dealership = items.find(i => i.id === dealershipId);
    if (!dealership) return;

    const updatedComments = (dealership.comments || []).map(c => 
      c.id === commentId ? { ...c, text: editingCommentText } : c
    );

    setItems(prev => prev.map(i => i.id === dealershipId ? { ...i, comments: updatedComments } : i));
    setEditingCommentId(null);
    setEditingCommentText("");

    await supabase.from("dealerships").update({ comments: updatedComments }).eq("id", dealershipId);
  };

  const handleDeleteComment = async (dealershipId: string, commentId: string) => {
    if (!confirm("Удалить комментарий?")) return;

    const dealership = items.find(i => i.id === dealershipId);
    if (!dealership) return;

    const updatedComments = (dealership.comments || []).filter(c => c.id !== commentId);

    setItems(prev => prev.map(i => i.id === dealershipId ? { ...i, comments: updatedComments } : i));

    await supabase.from("dealerships").update({ comments: updatedComments }).eq("id", dealershipId);
  };

  // Вычисляем дистанции, фильтруем и сортируем
  const processedItems = items
    .filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.address.toLowerCase().includes(search.toLowerCase()) ||
        item.phone.toLowerCase().includes(search.toLowerCase());

      const matchesCategory =
        selectedCategory === "Все" || item.category === selectedCategory;

      const matchesStatus =
        selectedStatus === "Все" || item.status === selectedStatus;
        
      const matchesCity = item.city === selectedCity;

      return matchesSearch && matchesCategory && matchesStatus && matchesCity;
    })
    .map((item) => {
      let distance = null;
      if (userLocation && item.lat && item.lng) {
        distance = getDistanceFromLatLonInKm(userLocation.lat, userLocation.lng, item.lat, item.lng);
      }
      return { ...item, distance };
    })
    .sort((a, b) => {
      if (a.distance !== null && b.distance !== null) {
        return a.distance - b.distance;
      }
      if (a.distance !== null) return -1;
      if (b.distance !== null) return 1;
      return 0;
    });

  const getStatusBadge = (status: Status) => {
    switch (status) {
      case "Новый":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "В работе":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "Сделка":
        return "bg-green-100 text-green-800 border-green-200";
      case "Отказ":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          <div className="text-center mb-8">
            <div className="inline-block p-1 bg-blue-50 rounded-2xl mb-4">
               <img src="/logo.png" alt="Logo" className="w-20 h-20 object-cover rounded-xl shadow-sm" onError={(e) => { e.currentTarget.src = 'https://placehold.co/100?text=CRM'; }} />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Авторизация в CRM</h1>
            <p className="text-slate-500 mt-2 text-sm">Пожалуйста, войдите в систему</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Логин</label>
              <input
                type="text"
                required
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Введите логин"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Пароль</label>
              <input
                type="password"
                required
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Введите пароль"
              />
            </div>
            
            {loginError && <p className="text-red-500 text-sm text-center">{loginError}</p>}

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition"
            >
              Войти
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      <div className="flex-1 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Шапка */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex flex-col gap-3">
              <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-4 text-slate-800">
                <img src="/logo.png" alt="Logo" className="w-10 h-10 object-cover rounded-lg shadow-sm" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                <span>CRM {selectedCity}</span>
                {currentUser && (
                  <span className="text-sm font-medium text-slate-500 ml-2 hidden md:inline-block bg-slate-100 px-3 py-1 rounded-full">
                    {currentUser} ({userRole})
                  </span>
                )}
              </h1>
              
              {/* CRM Type Tabs */}
              <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                <button
                  onClick={() => setActiveCrm('offline')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeCrm === "offline" ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-800"}`}
                >
                  <MapPin className="w-4 h-4 inline-block mr-1 -mt-0.5" />
                  Встречи (Оффлайн)
                </button>
                <button
                  onClick={() => setActiveCrm('calls')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeCrm === "calls" ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-800"}`}
                >
                  <PhoneCall className="w-4 h-4 inline-block mr-1 -mt-0.5" />
                  Холодные звонки
                </button>
              </div>
            </div>
            
            <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto max-w-full">
              {activeCrm === 'offline' ? (
                <>
                  <button
                    onClick={() => setSelectedCity("Белая Церковь" as City)}
                    className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition ${selectedCity === "Белая Церковь" ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-800"}`}
                  >
                    Белая Церковь
                  </button>
                  <button
                    onClick={() => setSelectedCity("Киев" as City)}
                    className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition ${selectedCity === "Киев" ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-800"}`}
                  >
                    Киев
                  </button>
                </>
              ) : (
                <>
                  {dbCities.map((city) => (
                    <button
                      key={city.name}
                      onClick={() => setSelectedCity(city.name as City)}
                      className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition ${selectedCity === city.name ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-800"}`}
                    >
                      {city.name}
                    </button>
                  ))}
                  {dbCities.length === 0 && (
                    <span className="px-4 py-2 text-sm text-slate-400">Нет добавленных городов</span>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              {userRole === 'SuperAdmin' && (
                <Link href="/admin" className="hidden sm:flex items-center gap-1 text-sm font-medium text-amber-600 hover:text-amber-700 bg-amber-50 px-3 py-2 rounded-lg transition">
                  <ShieldAlert className="w-4 h-4" />
                  Админ-панель
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="text-sm font-medium text-slate-500 hover:text-slate-800 transition"
              >
                Выйти
              </button>
              <button
                onClick={openAddModal}
                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl transition font-medium shadow-sm hover:shadow"
              >
                <Plus className="w-5 h-5" /> Добавить объект
              </button>
            </div>
          </header>

          {/* Панель поиска */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-4 md:space-y-0 md:flex md:items-center md:gap-4">
            <div className="relative flex-1">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Поиск по названию, адресу или телефону..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="Все">Все категории</option>
                <option value="Официальные автосалоны">Официальные автосалоны</option>
                <option value="Авторынки и площадки">Авторынки и площадки</option>
                <option value="Автовыкуп">Автовыкуп</option>
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="Все">Все статусы</option>
                <option value="Новый">Новый</option>
                <option value="В работе">В работе</option>
                <option value="Сделка">Сделка</option>
                <option value="Отказ">Отказ</option>
              </select>
            </div>
          </div>

          {/* Статистика */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium">Всего объектов ({selectedCity})</p>
                <p className="text-2xl font-bold text-slate-800">{processedItems.length}</p>
              </div>
              <Building2 className="w-8 h-8 text-slate-400 opacity-50" />
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium">В работе</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {processedItems.filter((i) => i.status === "В работе").length}
                </p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500 opacity-50" />
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium">Сделки</p>
                <p className="text-2xl font-bold text-green-600">
                  {processedItems.filter((i) => i.status === "Сделка").length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500 opacity-50" />
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium">Отказы</p>
                <p className="text-2xl font-bold text-red-600">
                  {processedItems.filter((i) => i.status === "Отказ").length}
                </p>
              </div>
              <XCircle className="w-8 h-8 text-red-500 opacity-50" />
            </div>
          </div>

          {/* Индикатор загрузки */}
          {loading && (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
              <p className="text-slate-500 text-sm">Загрузка данных...</p>
            </div>
          )}

          {/* Карточки */}
          {!loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {processedItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition overflow-hidden"
                >
                  <div className="p-5 pb-0">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 text-slate-600">
                        {item.category}
                      </span>
                      <select
                        value={item.status}
                        onChange={(e) => handleStatusChange(item.id, item.name, e.target.value as Status)}
                        className={`text-xs font-medium px-2.5 py-1 rounded-md border focus:outline-none cursor-pointer ${getStatusBadge(
                          item.status
                        )}`}
                      >
                        <option value="Новый">Новый</option>
                        <option value="В работе">В работе</option>
                        <option value="Сделка">Сделка</option>
                        <option value="Отказ">Отказ</option>
                      </select>
                    </div>

                    <Link href={`/dealership/${item.id}`}>
                      <h3 className="font-bold text-slate-800 text-lg mb-2 leading-snug hover:text-blue-600 transition">
                        {item.name}
                      </h3>
                    </Link>
                    
                    {item.distance !== null && (
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold mb-3">
                        <Map className="w-3.5 h-3.5" />
                        {item.distance.toFixed(1)} км от вас
                      </div>
                    )}

                    <div className="space-y-2 text-sm text-slate-600 mb-4">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <a href={`tel:${item.phone}`} className="hover:text-blue-600">
                          {item.phone}
                        </a>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                        <span className="leading-tight">{item.address}</span>
                      </div>
                      {item.link && item.link !== "-" && (
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <a
                            href={item.link.startsWith("http") ? item.link : `https://${item.link}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline truncate max-w-[200px]"
                          >
                            {item.link}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Comments Toggle Button */}
                  <div className="px-5 pb-3">
                    <button 
                      onClick={() => setExpandedCommentsId(expandedCommentsId === item.id ? null : item.id)}
                      className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Комментарии ({(item.comments || []).length})
                    </button>
                  </div>

                  {/* Expanded Comments Section */}
                  {expandedCommentsId === item.id && (
                    <div className="bg-slate-50 border-t border-slate-100 p-5 pt-4 flex flex-col gap-3">
                      <div className="max-h-48 overflow-y-auto space-y-3 pr-1">
                        {(item.comments || []).map(comment => (
                          <div key={comment.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold text-slate-700">{comment.author}</span>
                              <span className="text-[10px] text-slate-400">
                                {new Date(comment.createdAt).toLocaleDateString('ru-RU', {hour: '2-digit', minute: '2-digit'})}
                              </span>
                            </div>
                            
                            {editingCommentId === comment.id ? (
                              <div className="flex flex-col gap-2 mt-2">
                                <textarea
                                  value={editingCommentText}
                                  onChange={(e) => setEditingCommentText(e.target.value)}
                                  className="w-full text-sm p-2 border border-blue-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                                  rows={2}
                                />
                                <div className="flex gap-2 justify-end">
                                  <button onClick={() => setEditingCommentId(null)} className="text-xs text-slate-500 hover:text-slate-700">Отмена</button>
                                  <button onClick={() => handleEditComment(item.id, comment.id)} className="text-xs bg-blue-600 text-white px-3 py-1 rounded-md">Сохранить</button>
                                </div>
                              </div>
                            ) : (
                              <div className="group relative">
                                <p className="text-sm text-slate-600 leading-relaxed break-words">{comment.text}</p>
                                {comment.author === currentUser && (
                                  <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition flex gap-1 bg-white pl-2">
                                    <button 
                                      onClick={() => {
                                        setEditingCommentId(comment.id);
                                        setEditingCommentText(comment.text);
                                      }} 
                                      className="text-slate-400 hover:text-blue-600 p-1"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteComment(item.id, comment.id)} 
                                      className="text-slate-400 hover:text-red-600 p-1"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                        {(item.comments || []).length === 0 && (
                          <p className="text-xs text-center text-slate-400 py-2">Пока нет комментариев</p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="text"
                          placeholder="Написать комментарий..."
                          value={commentInputs[item.id] || ""}
                          onChange={(e) => setCommentInputs(prev => ({...prev, [item.id]: e.target.value}))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddComment(item.id);
                          }}
                          className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button 
                          onClick={() => handleAddComment(item.id)}
                          className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition shadow-sm"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="p-5 pt-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex gap-3">
                      <button
                        onClick={() => openEditModal(item)}
                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 font-medium transition"
                      >
                        <Edit className="w-3.5 h-3.5" /> Редактировать
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-600 font-medium transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Удалить
                      </button>
                    </div>
                    
                    <a
                      href={item.lat && item.lng 
                        ? `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}`
                        : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.address)}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition shadow-sm"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      Маршрут
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && processedItems.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
              <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">В городе {selectedCity} ничего не найдено по вашему запросу.</p>
            </div>
          )}

          {/* Модальное окно */}
          {isModalOpen && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-xl font-bold text-slate-800">
                    {editingItem ? "Редактировать объект" : "Добавить новый объект"}
                  </h2>
                  <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Название
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Город
                    </label>
                    {activeCrm === 'offline' ? (
                      <select
                        value={formData.city}
                        onChange={(e) =>
                          setFormData({ ...formData, city: e.target.value as City })
                        }
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Белая Церковь">Белая Церковь</option>
                        <option value="Киев">Киев</option>
                      </select>
                    ) : (
                      <div className="flex gap-2">
                        <select
                          value={formData.city}
                          onChange={(e) =>
                            setFormData({ ...formData, city: e.target.value as City })
                          }
                          className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {dbCities.length === 0 && <option value="">Сначала добавьте город</option>}
                          {dbCities.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                        </select>
                        <button
                          type="button"
                          onClick={async () => {
                            const newCity = prompt("Введите название нового города:");
                            if (newCity) {
                              await supabase.from("cities").insert([{ name: newCity, created_by: currentUser }]);
                              logAction(currentUser, 'ADD_CITY', undefined, newCity);
                              const { data } = await supabase.from("cities").select("name").order("name");
                              if (data) setDbCities(data);
                              setFormData({ ...formData, city: newCity as City });
                              setSelectedCity(newCity as City);
                            }
                          }}
                          className="px-3 py-2 bg-slate-200 hover:bg-slate-300 rounded-xl text-sm font-medium transition"
                        >
                          + Новый
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Категория
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value as Category })
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Официальные автосалоны">Официальные автосалоны</option>
                      <option value="Авторынки и площадки">Авторынки и площадки</option>
                      <option value="Автовыкуп">Автовыкуп</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Телефон
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Адрес
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Координаты (скопированные из Google Maps)
                    </label>
                    <input
                      type="text"
                      placeholder="Напр. 50.3572128, 30.4767149"
                      value={formData.coordinates}
                      onChange={(e) => setFormData({ ...formData, coordinates: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0 leading-tight">Координаты нужны для расчета дистанции. Если оставить пустым, маршрут будет строиться по адресу.</p>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Сайт / Ссылка
                    </label>
                    <input
                      type="text"
                      value={formData.link}
                      onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Статус
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value as Status })
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Новый">Новый</option>
                      <option value="В работе">В работе</option>
                      <option value="Сделка">Сделка</option>
                      <option value="Отказ">Отказ</option>
                    </select>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition"
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition"
                    >
                      Сохранить
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Footer */}
      <footer className="mt-auto py-6 border-t border-slate-200 bg-white text-center">
        <p className="text-sm text-slate-500">
          Разработчик:{" "}
          <a
            href="https://dispatcher-1.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline font-medium"
          >
            Dispatcher
          </a>
        </p>
      </footer>
    </div>
  );
}