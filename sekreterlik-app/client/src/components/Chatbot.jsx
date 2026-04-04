import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import GeminiService from '../services/GeminiService';
import ApiService from '../utils/ApiService';
import FirebaseService from '../services/FirebaseService';
import { useAuth } from '../contexts/AuthContext';
import { analyzeSentiment, getResponseTone } from '../utils/sentimentAnalysis';
import { predictMeetingAttendance, detectAnomalies, generateRecommendations, analyzeTrend } from '../utils/advancedAnalysis';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const Chatbot = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [siteData, setSiteData] = useState(null);
  const [bylawsText, setBylawsText] = useState('');
  const [aiProvider] = useState('gemini');
  const [showLimitInfo, setShowLimitInfo] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const messagesEndRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userRole } = useAuth();

  // Scroll to bottom when new message is added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load site data on mount (lazy load - only when chatbot is opened)
  useEffect(() => {
    if (isOpen && !siteData) {
      // Load data asynchronously without blocking UI
      Promise.all([
        loadSiteData(),
        loadBylaws()
      ]).catch(error => {
        console.error('Error loading chatbot data:', error);
      });

      // Welcome message with context awareness
      const welcomeMessage = getWelcomeMessage(userRole, location.pathname);
      setMessages([{
        id: Date.now(),
        role: 'assistant',
        content: welcomeMessage
      }]);
    }
  }, [isOpen, siteData]);

  // Proactive suggestions and alerts
  useEffect(() => {
    if (isOpen && siteData && messages.length <= 1) {
      // Wait a bit before showing proactive suggestions
      const timer = setTimeout(() => {
        const proactiveMessage = getProactiveSuggestions(siteData, userRole);
        if (proactiveMessage) {
          setMessages(prev => [...prev, {
            id: Date.now() + 1000,
            role: 'assistant',
            content: proactiveMessage,
            isProactive: true
          }]);
        }
      }, 2000); // Show after 2 seconds

      return () => clearTimeout(timer);
    }
  }, [isOpen, siteData, messages.length, userRole]);

  const loadSiteData = async () => {
    try {
      // Optimize: Load critical data first, then less critical data
      // This prevents blocking the UI for too long
      const [
        members,
        events,
        meetings,
        districts,
        towns,
        neighborhoods,
        villages
      ] = await Promise.all([
        ApiService.getMembers().catch(() => []),
        ApiService.getEvents().catch(() => []),
        ApiService.getMeetings().catch(() => []),
        ApiService.getDistricts().catch(() => []),
        ApiService.getTowns().catch(() => []),
        ApiService.getNeighborhoods().catch(() => []),
        ApiService.getVillages().catch(() => [])
      ]);

      // Set initial data to allow chatbot to work with basic info
      setSiteData(prev => ({
        ...prev,
        members,
        events,
        meetings,
        districts,
        towns,
        neighborhoods,
        villages
      }));

      // Load ALL additional data in background (non-blocking) - TÜM VERİLER
      Promise.all([
        // Seçim hazırlık verileri
        ApiService.getBallotBoxes().catch(() => []),
        ApiService.getBallotBoxObservers().catch(() => []),
        ApiService.getGroups().catch(() => []),

        // Yönetim verileri
        ApiService.getDistrictOfficials().catch(() => []),
        ApiService.getTownOfficials().catch(() => []),

        // Tüm yönetim üyeleri - Tüm district ve town'lar için
        Promise.all([
          ApiService.getDistricts().then(districts =>
            Promise.all(districts.map(d =>
              ApiService.getDistrictManagementMembers(d.id).catch(() => [])
            ))
          ).then(results => results.flat()).catch(() => []),
          ApiService.getTowns().then(towns =>
            Promise.all(towns.map(t =>
              ApiService.getTownManagementMembers(t.id).catch(() => [])
            ))
          ).then(results => results.flat()).catch(() => [])
        ]).then(([districtMembers, townMembers]) => ({
          districtManagementMembers: districtMembers,
          townManagementMembers: townMembers
        })).catch(() => ({ districtManagementMembers: [], townManagementMembers: [] })),

        // Temsilci ve sorumlu verileri
        ApiService.getNeighborhoodRepresentatives().catch(() => []),
        ApiService.getVillageRepresentatives().catch(() => []),
        ApiService.getNeighborhoodSupervisors().catch(() => []),
        ApiService.getVillageSupervisors().catch(() => []),
        ApiService.getAllDistrictDeputyInspectors().catch(() => []),
        ApiService.getAllTownDeputyInspectors().catch(() => []),

        // Ziyaret sayıları
        ApiService.getAllVisitCounts('neighborhood').catch(() => []),
        ApiService.getAllVisitCounts('village').catch(() => []),
        ApiService.getAllVisitCounts('stk').catch(() => []),
        ApiService.getAllVisitCounts('public_institution').catch(() => []),
        ApiService.getAllVisitCounts('mosque').catch(() => []),

        // Üye kayıtları
        ApiService.getMemberRegistrations().catch(() => []),

        // STK, Kamu Kurumu ve Cami verileri
        ApiService.getSTKs().catch(() => []),
        ApiService.getPublicInstitutions().catch(() => []),
        ApiService.getMosques().catch(() => []),

        // Etkinlik kategorileri
        ApiService.getEventCategories().catch(() => []),

        // Tüm kişisel belgeler - Tüm üyeler için
        ApiService.getMembers().then(members =>
          Promise.all(members.map(m =>
            ApiService.getPersonalDocuments(m.id).catch(() => [])
          ))
        ).then(results => results.flat()).catch(() => []),

        // Arşiv verileri
        ApiService.getDocuments().catch(() => []),

        // Arşivlenmiş üyeler, toplantılar, etkinlikler
        ApiService.getMembers(true).catch(() => []), // archived members
        ApiService.getMeetings(true).catch(() => []), // archived meetings
        ApiService.getEvents(true).catch(() => []), // archived events

        // Seçim verileri
        ApiService.getElections().catch(() => []),
        // Tüm seçimler için sonuçları al
        ApiService.getElections().then(elections => {
          if (!elections || elections.length === 0) return [];
          return Promise.all(
            elections.map(election =>
              ApiService.getElectionResults(election.id, null).catch(() => [])
            )
          ).then(results => results.flat());
        }).catch(() => []),
        // Tüm seçimler için ittifakları al
        ApiService.getElections().then(elections => {
          if (!elections || elections.length === 0) return [];
          return Promise.all(
            elections.map(election =>
              ApiService.getAlliances(election.id).catch(() => [])
            )
          ).then(alliances => {
            // Her ittifakı election_id ile eşleştir
            const alliancesByElection = {};
            alliances.forEach(alliance => {
              const electionId = String(alliance.election_id || alliance.electionId);
              if (!alliancesByElection[electionId]) {
                alliancesByElection[electionId] = [];
              }
              alliancesByElection[electionId].push(alliance);
            });
            return alliancesByElection;
          });
        }).catch(() => ({}))
      ]).then(([
        ballotBoxes,
        observers,
        groups,
        districtOfficials,
        townOfficials,
        managementMembersData,
        neighborhoodRepresentatives,
        villageRepresentatives,
        neighborhoodSupervisors,
        villageSupervisors,
        districtDeputyInspectors,
        townDeputyInspectors,
        neighborhoodVisitCounts,
        villageVisitCounts,
        stkVisitCounts,
        publicInstitutionVisitCounts,
        mosqueVisitCounts,
        memberRegistrations,
        stks,
        publicInstitutions,
        mosques,
        eventCategories,
        personalDocuments,
        archiveDocuments,
        archivedMembers,
        archivedMeetings,
        archivedEvents,
        elections,
        electionResults,
        alliancesByElection
      ]) => {
        // Performans puanlarını hesapla (üye yıldızları için)
        // Async IIFE kullanarak await kullanabiliriz
        (async () => {
          let performanceScores = [];
          try {
            const { calculateAllMemberScores } = await import('../utils/performanceScore');
            performanceScores = await calculateAllMemberScores(
              members,
              meetings,
              events,
              memberRegistrations,
              {
                includeBonus: true,
                timeRange: 'all',
                weightRecent: false
              }
            );
          } catch (error) {
            console.error('Error calculating performance scores:', error);
          }

          // Debug: Seçim verilerini kontrol et
          console.log('🔍 [CHATBOT DEBUG] Seçim verileri yüklendi:', {
            electionsCount: elections?.length || 0,
            electionResultsCount: electionResults?.length || 0,
            elections: elections?.slice(0, 3).map(e => ({ id: e.id, name: e.name, type: e.type })),
            sampleResults: electionResults?.slice(0, 2).map(r => ({
              electionId: r.election_id || r.electionId,
              ballotNumber: r.ballot_number || r.ballotNumber,
              hasSignedProtocol: !!(r.signed_protocol_photo || r.signedProtocolPhoto),
              hasObjectionProtocol: !!(r.objection_protocol_photo || r.objectionProtocolPhoto)
            }))
          });

          // Update with ALL additional data
          setSiteData(prev => ({
            ...prev,
            ballotBoxes,
            observers,
            groups,
            districtOfficials,
            townOfficials,
            districtManagementMembers: managementMembersData?.districtManagementMembers || [],
            townManagementMembers: managementMembersData?.townManagementMembers || [],
            neighborhoodRepresentatives,
            villageRepresentatives,
            neighborhoodSupervisors,
            villageSupervisors,
            districtDeputyInspectors,
            townDeputyInspectors,
            neighborhoodVisitCounts,
            villageVisitCounts,
            stkVisitCounts,
            publicInstitutionVisitCounts,
            mosqueVisitCounts,
            memberRegistrations,
            stks,
            publicInstitutions,
            mosques,
            eventCategories,
            personalDocuments,
            archiveDocuments,
            archivedMembers,
            archivedMeetings,
            archivedEvents,
            elections: elections || [],
            electionResults: electionResults || [],
            alliancesByElection: alliancesByElection || {},
            performanceScores
          }));
        })();
      }).catch(error => {
        console.error('Error loading additional site data:', error);
      });
    } catch (error) {
      console.error('Error loading site data:', error);
    }
  };

  const loadBylaws = async () => {
    try {
      // Firebase'den tüzük metnini veya URL'yi yükle
      const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true';

      if (USE_FIREBASE) {
        try {
          const { getDoc, doc } = await import('firebase/firestore');
          const { db } = await import('../config/firebase');
          const bylawsRef = doc(db, 'bylaws', 'main');
          const bylawsSnap = await getDoc(bylawsRef);

          if (bylawsSnap.exists()) {
            const bylawsData = bylawsSnap.data();

            console.log('📋 Bylaws data loaded:', {
              hasText: !!bylawsData.text,
              textLength: bylawsData.text?.length || 0,
              hasUrl: !!bylawsData.url,
              url: bylawsData.url
            });

            // Önce text varsa onu kullan (text varsa URL'yi ignore et)
            if (bylawsData.text && bylawsData.text.trim()) {
              console.log('✅ Using bylaws text (length:', bylawsData.text.length, ')');
              setBylawsText(bylawsData.text.trim());
            }
            // Eğer text yoksa ama URL varsa, URL'den içeriği çek
            else if (bylawsData.url) {
              console.log('⚠️ No text found, trying to fetch from URL:', bylawsData.url);
              try {
                // Backend API'den URL'den içeriği çek
                const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true';
                let API_BASE_URL;

                if (USE_FIREBASE) {
                  // Render.com'da backend URL'i environment variable'dan al
                  API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://sekreterlik-backend.onrender.com/api';
                } else {
                  API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
                }

                console.log('Loading bylaws from URL:', bylawsData.url, 'API:', API_BASE_URL);

                const response = await fetch(`${API_BASE_URL}/bylaws/fetch?url=${encodeURIComponent(bylawsData.url)}`, {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json'
                  }
                });

                console.log('Bylaws load response status:', response.status);

                if (response.ok) {
                  const data = await response.json();
                  console.log('Bylaws load success:', data.success, 'Text length:', data.text?.length);

                  if (data.success && data.text) {
                    setBylawsText(data.text);
                  } else {
                    // Backend başarısız olursa, URL'yi kaydet
                    setBylawsText(`TÜZÜK_LINK:${bylawsData.url}`);
                  }
                } else {
                  const errorText = await response.text();
                  console.error('Bylaws load error:', response.status, errorText);
                  // Backend hatası olursa, URL'yi kaydet
                  setBylawsText(`TÜZÜK_LINK:${bylawsData.url}`);
                }
              } catch (fetchError) {
                console.error('Error fetching bylaws from URL:', fetchError);
                // Hata olursa, URL'yi kaydet
                setBylawsText(`TÜZÜK_LINK:${bylawsData.url}`);
              }
            }
          }
        } catch (error) {
          console.error('Error loading bylaws from Firebase:', error);
          // Tüzük yoksa, boş bırak
        }
      }
    } catch (error) {
      console.error('Error loading bylaws:', error);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Sadece resim dosyaları desteklenir');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Dosya boyutu 5MB\'dan küçük olmalıdır');
      return;
    }

    setLoading(true);

    // Add user message with image preview
    const imageUrl = URL.createObjectURL(file);
    setMessages(prev => [...prev, {
      id: Date.now(),
      role: 'user',
      content: 'Görsel gönderildi',
      imageUrl
    }]);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result.split(',')[1];
        try {
          const response = await GeminiService.analyzeImage(base64, file.type, 'Bu görseli analiz et ve içeriğini açıkla');
          setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: response }]);
        } catch (error) {
          setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: 'Görsel analiz edilirken hata oluştu: ' + error.message }]);
        } finally {
          setLoading(false);
        }
      };
      reader.onerror = () => {
        setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: 'Görsel okunurken hata oluştu' }]);
        setLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: 'Görsel analiz edilirken hata oluştu: ' + error.message }]);
      setLoading(false);
    }

    e.target.value = ''; // Reset file input
  };

  const handleSend = async (e) => {
    e.preventDefault();

    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setError('');
    setLoading(true);

    // Add user message
    const newUserMessage = {
      id: Date.now(),
      role: 'user',
      content: userMessage
    };
    setMessages(prev => [...prev, newUserMessage]);

    try {
      // Build context from site data
      const context = [];

      // RAG: SEÇMEN SORGULAMA (Dosyalardan Arama)
      // Kullanıcı mesajı ile veritabanında dinamik arama yap
      if (userMessage.length >= 2) {
        try {
          console.log('🔍 [CHATBOT] Seçmen araması yapılıyor:', userMessage);
          const voterResults = await ApiService.searchVoters(userMessage);

          if (voterResults && voterResults.length > 0) {
            console.log('✅ [CHATBOT] Seçmen bulundu:', voterResults.length);
            context.push(`\n=== 📂 YÜKLENEN DOSYALARDAN BULUNAN KAYITLAR (RAG) ===`);
            context.push(`Kullanıcının sorusuyla ("${userMessage}") eşleşen ${voterResults.length} kişi dosyalarınızda bulundu:`);

            voterResults.slice(0, 5).forEach((voter, index) => { // Max 5 kayıt göster (token tasarrufu)
              context.push(`${index + 1}. AD SOYAD: ${voter.fullName} | TC: ${voter.tc} | TEL: ${voter.phone} | BÖLGE: ${voter.region} ${voter.district ? `(${voter.district})` : ''} | GÖREV: ${voter.role}`);
            });

            if (voterResults.length > 5) {
              context.push(`... ve ${voterResults.length - 5} benzer kayıt daha var.`);
            }
            context.push(`YÖNERGE: Kullanıcı bu kişileri soruyorsa yukarıdaki bilgileri ver. Eğer sormuyorsa bu bilgiyi görmezden gel.`);
          }
        } catch (searchErr) {
          console.warn('Chatbot voter search error:', searchErr);
          // Sessizce devam et
        }
      }

      // Add user context and role information
      if (user && userRole) {
        context.push(`\n=== KULLANICI BİLGİLERİ ===`);
        context.push(`Kullanıcı Rolü: ${userRole}`);
        if (user.name) context.push(`Kullanıcı Adı: ${user.name}`);
        if (location.pathname) context.push(`Mevcut Sayfa: ${location.pathname}`);
      }

      if (siteData) {
        const AIService = GeminiService;

        const siteContext = AIService.buildSiteContext(siteData);
        context.push(...siteContext);

        // Debug: Context'e eklenen seçim verilerini kontrol et
        const electionContextLines = siteContext.filter(line =>
          line.includes('SEÇİM') || line.includes('seçim') || line.includes('Seçim')
        );
        if (electionContextLines.length > 0) {
          console.log('✅ [CHATBOT DEBUG] Seçim verileri context\'e eklendi:', {
            electionContextLinesCount: electionContextLines.length,
            sampleLines: electionContextLines.slice(0, 5)
          });
        } else {
          console.warn('⚠️ [CHATBOT DEBUG] Seçim verileri context\'e eklenmemiş!', {
            hasElections: !!(siteData.elections && siteData.elections.length > 0),
            hasElectionResults: !!(siteData.electionResults && siteData.electionResults.length > 0),
            electionsCount: siteData.elections?.length || 0,
            electionResultsCount: siteData.electionResults?.length || 0
          });
        }

        // Check if user is asking about a specific member (with all site data for comprehensive info)
        const memberContext = AIService.buildMemberContext(
          siteData.members,
          userMessage,
          siteData // Tüm site verilerini gönder (meetings, representatives, supervisors, observers vb.)
        );
        context.push(...memberContext);
      }

      // Add bylaws text or URL if available (daha fazla karakter - tüzük önemli)
      if (bylawsText) {
        // Tüzük metnini kısalt (token limiti için - max 50000 karakter - tüzük çok önemli)
        const MAX_BYLAWS_LENGTH = 50000;
        const shortenedBylaws = bylawsText.length > MAX_BYLAWS_LENGTH
          ? bylawsText.substring(0, MAX_BYLAWS_LENGTH) + '\n\n[Tüzük metni kısaltıldı - token limiti nedeniyle]'
          : bylawsText;

        console.log('📋 Adding bylaws to context:', {
          textLength: bylawsText.length,
          startsWithLink: bylawsText.startsWith('TÜZÜK_LINK:'),
          preview: bylawsText.substring(0, 100)
        });

        // Eğer URL ise (TÜZÜK_LINK: ile başlıyorsa), tekrar çekmeyi dene
        if (bylawsText.startsWith('TÜZÜK_LINK:')) {
          console.log('⚠️ Bylaws text is a link, trying to fetch...');
          const url = bylawsText.replace('TÜZÜK_LINK:', '');
          try {
            // Backend API'den URL'den içeriği çek
            // Firebase kullanılıyorsa backend URL'i kontrol et
            const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true';
            let API_BASE_URL;

            if (USE_FIREBASE) {
              // Render.com'da backend URL'i environment variable'dan al
              API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://sekreterlik-backend.onrender.com/api';
            } else {
              API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
            }

            console.log('Fetching bylaws from URL:', url, 'API:', API_BASE_URL);

            const response = await fetch(`${API_BASE_URL}/bylaws/fetch?url=${encodeURIComponent(url)}`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json'
              }
            });

            console.log('Bylaws fetch response status:', response.status);

            if (response.ok) {
              const data = await response.json();
              console.log('Bylaws fetch success:', data.success, 'Text length:', data.text?.length);

              if (data.success && data.text) {
                // Tüzük metnini context'e ekle (ilk 50000 karakter - tüzük çok önemli)
                const text = data.text.substring(0, 50000);
                context.push(`TÜZÜK BİLGİLERİ:\n${text}${data.text.length > 50000 ? '... (devamı var)' : ''}`);
              } else {
                // Backend başarısız olursa, URL'yi kullan
                context.push(`TÜZÜK BİLGİLERİ: Parti tüzüğü şu web linkinde bulunmaktadır: ${url}. Tüzük hakkında sorular için bu linki ziyaret edebilirsiniz.`);
              }
            } else {
              const errorText = await response.text();
              console.error('Bylaws fetch error:', response.status, errorText);
              // Backend hatası olursa, URL'yi kullan
              context.push(`TÜZÜK BİLGİLERİ: Parti tüzüğü şu web linkinde bulunmaktadır: ${url}. Tüzük hakkında sorular için bu linki ziyaret edebilirsiniz.`);
            }
          } catch (fetchError) {
            console.error('Error fetching bylaws from URL:', fetchError);
            // Hata olursa, URL'yi kullan
            context.push(`TÜZÜK BİLGİLERİ: Parti tüzüğü şu web linkinde bulunmaktadır: ${url}. Tüzük hakkında sorular için bu linki ziyaret edebilirsiniz.`);
          }
        } else {
          // Normal metin ise, tüm metni kullan (tüzük metni önemli, mümkün olduğunca fazla karakter kullan)
          console.log('✅ Using bylaws text directly (length:', bylawsText.length, ')');
          // Tüzük metni çok uzun olabilir, ama mümkün olduğunca fazla karakter kullan (max 50000 karakter)
          const maxLength = 50000;
          const textToAdd = bylawsText.length > maxLength
            ? bylawsText.substring(0, maxLength) + '... (devamı var - tüzük metni çok uzun)'
            : bylawsText;
          context.push(`TÜZÜK BİLGİLERİ:\n${textToAdd}`);
        }

        // Dashboard İstatistikleri
        if (siteData.members && siteData.meetings && siteData.events) {
          const totalMembers = siteData.members.length;
          const totalMeetings = siteData.meetings.filter(m => !m.archived).length;
          const totalEvents = siteData.events.filter(e => !e.archived).length;

          // Ortalama toplantı katılım oranı
          let totalAttendanceRate = 0;
          let meetingsWithAttendees = 0;
          siteData.meetings.filter(m => !m.archived).forEach(meeting => {
            if (meeting.attendees && meeting.attendees.length > 0) {
              const attended = meeting.attendees.filter(a => a.attended === true).length;
              const rate = (attended / meeting.attendees.length) * 100;
              totalAttendanceRate += rate;
              meetingsWithAttendees++;
            }
          });
          const avgMeetingAttendanceRate = meetingsWithAttendees > 0
            ? Math.round(totalAttendanceRate / meetingsWithAttendees)
            : 0;

          context.push(`\n=== DASHBOARD İSTATİSTİKLERİ ===`);
          context.push(`Toplam Üye Sayısı: ${totalMembers}`);
          context.push(`Toplam Toplantı Sayısı: ${totalMeetings}`);
          context.push(`Ortalama Toplantı Katılım Oranı: %${avgMeetingAttendanceRate}`);
          context.push(`Toplam Etkinlik Sayısı: ${totalEvents}`);

          // Kategori bazında etkinlik istatistikleri
          if (siteData.eventCategories && siteData.events) {
            const categoryStats = {};
            siteData.events.filter(e => !e.archived).forEach(event => {
              if (event.category) {
                const category = siteData.eventCategories.find(c => String(c.id) === String(event.category));
                const categoryName = category ? category.name : 'Kategori Yok';
                categoryStats[categoryName] = (categoryStats[categoryName] || 0) + 1;
              }
            });
            if (Object.keys(categoryStats).length > 0) {
              context.push(`\nKategori Bazında Etkinlik Sayıları:`);
              Object.entries(categoryStats).forEach(([category, count]) => {
                context.push(`  ${category}: ${count} etkinlik`);
              });
            }
          }

          // Mahalle ve köy istatistikleri
          if (siteData.neighborhoods) {
            context.push(`\nToplam Mahalle Sayısı: ${siteData.neighborhoods.length}`);
            const totalNeighborhoodVisits = (siteData.neighborhoodVisitCounts || []).reduce((sum, v) => sum + (v.visit_count || 0), 0);
            context.push(`Toplam Mahalle Ziyaret Sayısı: ${totalNeighborhoodVisits}`);
            const assignedNeighborhoodReps = new Set((siteData.neighborhoodRepresentatives || []).map(r => String(r.neighborhood_id))).size;
            context.push(`Atanmış Mahalle Temsilci Sayısı: ${assignedNeighborhoodReps}`);
          }

          if (siteData.villages) {
            context.push(`\nToplam Köy Sayısı: ${siteData.villages.length}`);
            const totalVillageVisits = (siteData.villageVisitCounts || []).reduce((sum, v) => sum + (v.visit_count || 0), 0);
            context.push(`Toplam Köy Ziyaret Sayısı: ${totalVillageVisits}`);
            const assignedVillageReps = new Set((siteData.villageRepresentatives || []).map(r => String(r.village_id))).size;
            context.push(`Atanmış Köy Temsilci Sayısı: ${assignedVillageReps}`);
          }

          // STK ve Kamu Kurumu istatistikleri
          if (siteData.stks) {
            context.push(`\nToplam STK Sayısı: ${siteData.stks.length}`);
            const totalSTKVisits = (siteData.stkVisitCounts || []).reduce((sum, v) => sum + (v.visit_count || 0), 0);
            context.push(`Toplam STK Ziyaret Sayısı: ${totalSTKVisits}`);
          }

          if (siteData.publicInstitutions) {
            context.push(`\nToplam Kamu Kurumu Sayısı: ${siteData.publicInstitutions.length}`);
            const totalPublicInstitutionVisits = (siteData.publicInstitutionVisitCounts || []).reduce((sum, v) => sum + (v.visit_count || 0), 0);
            context.push(`Toplam Kamu Kurumu Ziyaret Sayısı: ${totalPublicInstitutionVisits}`);
          }
        }
      }

      // Enhanced context for comparative analysis
      if (userMessage.toLowerCase().includes('karşılaştır') ||
        userMessage.toLowerCase().includes('geçen') ||
        userMessage.toLowerCase().includes('trend') ||
        userMessage.toLowerCase().includes('artış') ||
        userMessage.toLowerCase().includes('azalış')) {
        context.push(`\n=== KARŞILAŞTIRMALI ANALİZ İSTEĞİ ===`);
        context.push(`Kullanıcı karşılaştırmalı analiz veya trend analizi istiyor.`);

        // Add time-based statistics
        if (siteData.meetings) {
          const now = new Date();
          const thisMonth = now.getMonth();
          const thisYear = now.getFullYear();
          const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
          const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

          const thisMonthMeetings = siteData.meetings.filter(m => {
            if (!m.date) return false;
            try {
              const date = new Date(m.date.split('.').reverse().join('-'));
              return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
            } catch {
              return false;
            }
          });

          const lastMonthMeetings = siteData.meetings.filter(m => {
            if (!m.date) return false;
            try {
              const date = new Date(m.date.split('.').reverse().join('-'));
              return date.getMonth() === lastMonth && date.getFullYear() === lastMonthYear;
            } catch {
              return false;
            }
          });

          context.push(`Bu Ay Toplantı Sayısı: ${thisMonthMeetings.length}`);
          context.push(`Geçen Ay Toplantı Sayısı: ${lastMonthMeetings.length}`);

          // Calculate attendance trends
          const thisMonthAvg = calculateAverageAttendance(thisMonthMeetings);
          const lastMonthAvg = calculateAverageAttendance(lastMonthMeetings);
          context.push(`Bu Ay Ortalama Katılım: %${thisMonthAvg}`);
          context.push(`Geçen Ay Ortalama Katılım: %${lastMonthAvg}`);

          if (thisMonthAvg > lastMonthAvg) {
            context.push(`Katılım Trendi: Artış var (+${(thisMonthAvg - lastMonthAvg).toFixed(1)}%)`);
          } else if (thisMonthAvg < lastMonthAvg) {
            context.push(`Katılım Trendi: Azalış var (${(thisMonthAvg - lastMonthAvg).toFixed(1)}%)`);
          } else {
            context.push(`Katılım Trendi: Değişiklik yok`);
          }
        }
      }

      // Build conversation history (last 20 messages for better context - devam eden sohbet için)
      // Proaktif mesajları da dahil et ama daha az ağırlık ver
      const conversationHistory = messages
        .filter(msg => !msg.isFeedback) // Feedback mesajlarını çıkar
        .slice(-20) // Son 20 mesajı hatırla
        .map(msg => ({
          role: msg.role,
          content: msg.content,
          isProactive: msg.isProactive || false
        }));

      // Check for help commands
      const helpKeywords = ['yardım', 'help', 'nasıl', 'komut', 'ne yapabilir', 'ne sorabilir', 'kullanım'];
      const isHelpRequest = helpKeywords.some(keyword => userMessage.toLowerCase().includes(keyword));

      if (isHelpRequest) {
        const helpMessage = getHelpMessage(userRole);
        const newAssistantMessage = {
          id: Date.now() + 1,
          role: 'assistant',
          content: helpMessage
        };
        setMessages(prev => [...prev, newAssistantMessage]);
        setLoading(false);
        return;
      }

      // Check for report requests
      const reportKeywords = ['rapor', 'report', 'istatistik', 'statistic', 'özet', 'summary', 'excel', 'pdf'];
      const isReportRequest = reportKeywords.some(keyword => userMessage.toLowerCase().includes(keyword));

      if (isReportRequest && userRole === 'admin') {
        // Add report context
        context.push(`\n=== RAPOR İSTEĞİ ===`);
        context.push(`Kullanıcı rapor istiyor. Mevcut raporlar: Toplantı Raporu, Üye Performans Raporu, Etkinlik Raporu, Katılım Raporu.`);
        context.push(`Raporlar sayfasına yönlendirme yapılabilir veya chatbot üzerinden özet rapor verilebilir.`);
      }

      // Check for automatic action requests
      const createMeetingPattern = /(toplantı|meeting)\s+(?:oluştur|create|yap|düzenle)/i;
      if (createMeetingPattern.test(userMessage) && userRole === 'admin') {
        // Extract meeting details from message
        const nameMatch = userMessage.match(/(?:adı|name|isim)[\s:]+(.+?)(?:\s|$|,)/i);
        const dateMatch = userMessage.match(/(?:tarih|date)[\s:]+(.+?)(?:\s|$|,)/i);
        const regionMatch = userMessage.match(/(?:bölge|region)[\s:]+(.+?)(?:\s|$|,)/i);

        const params = {};
        if (nameMatch) params.name = nameMatch[1].trim();
        if (dateMatch) params.date = dateMatch[1].trim();
        if (regionMatch) params.regions = regionMatch[1].split(',').map(r => r.trim());

        const actionHandled = await handleAutomaticAction('create_meeting', params);
        if (actionHandled) {
          setLoading(false);
          return;
        }
      }

      // Check for advanced search patterns
      const searchPatterns = [
        { pattern: /(.+?)(?:'in|'nin|'un|'ün)\s+(?:katıldığı|gittiği|olduğu)\s+(toplantılar|etkinlikler)/i, type: 'member_events' },
        { pattern: /(.+?)(?:'in|'nin|'un|'ün)\s+(bilgileri|hakkında|detayları)/i, type: 'member_info' },
        { pattern: /(toplantı|etkinlik)\s+(.+?)\s+(hakkında|detayları)/i, type: 'event_info' },
        { pattern: /(bu ay|geçen ay|bu hafta|geçen hafta)\s+(toplantı|etkinlik|üye|katılım)/i, type: 'time_filter' }
      ];

      // Enhanced search handling
      for (const searchPattern of searchPatterns) {
        const match = userMessage.match(searchPattern.pattern);
        if (match) {
          // Add enhanced context for search
          context.push(`\n=== GELİŞMİŞ ARAMA İSTEĞİ ===`);
          context.push(`Arama Tipi: ${searchPattern.type}`);
          context.push(`Arama Terimi: ${match[1] || match[2] || userMessage}`);
        }
      }

      // Role-specific training context
      const roleSpecificContext = getRoleSpecificContext(userRole);

      // Duygu analizi
      const sentimentResult = analyzeSentiment(userMessage);
      const responseTone = getResponseTone(sentimentResult);

      // Gelişmiş analiz (anomali tespiti ve öneriler)
      const anomalies = siteData ? detectAnomalies(siteData) : [];
      const recommendations = siteData ? generateRecommendations(siteData, userRole) : [];

      // Enhanced AI prompt with better context understanding and training
      const conversationSummary = conversationHistory.length > 0
        ? `\n=== ÖNCEKİ KONUŞMA ÖZETİ ===\n` +
        `Toplam ${conversationHistory.length} mesaj var. Önceki konuşmalarda şunlar konuşuldu:\n` +
        conversationHistory.slice(0, 5).map((msg, idx) =>
          `${idx + 1}. ${msg.role === 'user' ? 'Kullanıcı' : 'Sen'}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`
        ).join('\n') +
        (conversationHistory.length > 5 ? `\n... ve ${conversationHistory.length - 5} mesaj daha` : '')
        : '';

      // Duygu analizi context'i
      const sentimentContext = `\n=== DUYGU ANALİZİ ===
Kullanıcının mesajından tespit edilen duygu:
- Duygu: ${sentimentResult.emotion}
- Sentiment: ${sentimentResult.sentiment === 'positive' ? 'Pozitif' : sentimentResult.sentiment === 'negative' ? 'Negatif' : 'Nötr'}
- Yoğunluk: ${sentimentResult.intensity}
- Önerilen yanıt tonu: ${responseTone}

ÖNEMLİ: Kullanıcı ${sentimentResult.sentiment === 'negative' ? 'olumsuz' : sentimentResult.sentiment === 'positive' ? 'olumlu' : 'nötr'} bir duygu durumunda. Yanıtını ${responseTone} bir tonla ver.`;

      // Gelişmiş analiz context'i
      const analysisContext = anomalies.length > 0 || recommendations.length > 0
        ? `\n=== GELİŞMİŞ ANALİZ ===
${anomalies.length > 0 ? `Tespit edilen anomaliler (${anomalies.length} adet):\n${anomalies.slice(0, 3).map(a => `- ${a.message}`).join('\n')}\n` : ''}
${recommendations.length > 0 ? `Öneriler (${recommendations.length} adet):\n${recommendations.slice(0, 3).map(r => `- ${r.title}: ${r.description}`).join('\n')}\n` : ''}
Bu bilgileri kullanarak kullanıcıya proaktif öneriler sunabilirsin.`
        : '';

      const enhancedContext = [
        ...context,
        `\n=== KONUŞMA BAĞLAMI ===`,
        `Bu bir parti sekreterlik yönetim sistemidir.`,
        `Kullanıcı rolü: ${userRole || 'bilinmiyor'}`,
        `Mevcut sayfa: ${location.pathname}`,
        `Konuşma geçmişi: ${conversationHistory.length} mesaj`,
        conversationSummary,
        sentimentContext,
        analysisContext,
        ...roleSpecificContext,
        `\n=== SOHBET MODU ===`,
        `Bu bir devam eden sohbet. Önceki konuşmaları hatırla ve referans ver.`,
        `Kullanıcı önceki bir konuya değinirse, o konuyu hatırla ve devam ettir.`,
        `Kendi fikirlerini ve önerilerini sun. Sadece bilgi verme, aynı zamanda yorum yap ve öner.`,
        `Samimi ve sohbet eder gibi konuş. Çok formal olma, ama saygılı kal.`,
        `Önceki mesajlarda bahsedilen konuları hatırla ve bağlantı kur.`,
        `Kullanıcı "önceki konu", "az önce", "daha önce" gibi ifadeler kullanırsa, önceki konuşmalara referans ver.`,
        `\nÖNEMLİ: Uzun konuşmalarda önceki mesajları dikkate al ve bağlamı koru.`,
        `Kullanıcının sorusuna net, samimi ve sohbet eder gibi cevap ver.`,
        `Gerekirse örnekler ver, kendi görüşlerini belirt ve kullanıcıyı yönlendir.`,
        `Chain of Thought: Önce soruyu anla, önceki konuşmaları kontrol et, sonra context'te ilgili bilgileri bul, sonra kendi görüşlerini ekle, sonra cevabı oluştur.`
      ];

      // Araç çağrıları için en güncel site verisini GeminiService'e aktar
      GeminiService.setSiteData(siteData);

      // Add a "typing" streaming message first
      const typingMsgId = Date.now() + 1;
      setMessages(prev => [...prev, { id: typingMsgId, role: 'assistant', content: '', isStreaming: true }]);

      let finalResponse = '';
      try {
        finalResponse = await GeminiService.chatStream(
          userMessage,
          enhancedContext,
          conversationHistory,
          (chunk, fullText) => {
            setMessages(prev => prev.map(msg =>
              msg.id === typingMsgId ? { ...msg, content: fullText } : msg
            ));
          }
        );

        // Mark streaming as done
        setMessages(prev => prev.map(msg =>
          msg.id === typingMsgId ? { ...msg, isStreaming: false } : msg
        ));
      } catch (streamError) {
        console.warn('Streaming failed, falling back to non-streaming:', streamError.message);
        finalResponse = await GeminiService.chat(userMessage, enhancedContext, conversationHistory);
        setMessages(prev => prev.map(msg =>
          msg.id === typingMsgId ? { ...msg, content: finalResponse, isStreaming: false } : msg
        ));
      }

      const response = finalResponse;

      // Process response for report links
      let processedResponse = response;

      // Check if response contains report-related content and add action buttons
      if (isReportRequest && userRole === 'admin' && (response.toLowerCase().includes('rapor') || response.toLowerCase().includes('report'))) {
        processedResponse += `\n\n💡 Hızlı Erişim:\n`;
        processedResponse += `• [Raporlar Sayfasına Git](/reports) - Detaylı raporlar için\n`;
        processedResponse += `• [Toplantı Raporu](/reports?type=meetings) - Toplantı istatistikleri\n`;
        processedResponse += `• [Üye Performans Raporu](/reports?type=members) - Üye performans puanları\n`;
      }

      // Görselleştirme: Eğer kullanıcı grafik istiyorsa
      const visualizationKeywords = ['grafik', 'chart', 'görsel', 'görselleştir', 'göster', 'çiz', 'tablo'];
      const wantsVisualization = visualizationKeywords.some(keyword =>
        userMessage.toLowerCase().includes(keyword)
      );

      // Görselleştirme verisi hazırla
      let visualizationData = null;
      if (wantsVisualization && siteData) {
        // Toplantı katılım grafiği
        if (userMessage.toLowerCase().includes('toplantı') || userMessage.toLowerCase().includes('katılım')) {
          const meetings = siteData.meetings?.filter(m => !m.archived && m.attendees) || [];
          if (meetings.length > 0) {
            visualizationData = {
              type: 'attendance',
              data: meetings.slice(-10).map(m => {
                const attended = m.attendees.filter(a => a.attended === true).length;
                const total = m.attendees.length;
                return {
                  name: m.name?.substring(0, 20) || 'Toplantı',
                  katılım: total > 0 ? Math.round((attended / total) * 100) : 0,
                  katılan: attended,
                  toplam: total
                };
              })
            };
          }
        }
        // Üye performans grafiği
        else if (userMessage.toLowerCase().includes('üye') || userMessage.toLowerCase().includes('performans')) {
          const performanceScores = siteData.performanceScores || [];
          if (performanceScores.length > 0) {
            visualizationData = {
              type: 'performance',
              data: performanceScores
                .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
                .slice(0, 10)
                .map(score => ({
                  name: score.member?.name?.substring(0, 15) || 'Üye',
                  puan: score.totalScore || 0,
                  yıldız: score.stars || score.averageStars || 0
                }))
            };
          }
        }
        // Etkinlik grafiği
        else if (userMessage.toLowerCase().includes('etkinlik')) {
          const events = siteData.events?.filter(e => !e.archived) || [];
          if (events.length > 0) {
            // Ay bazında grupla
            const eventsByMonth = {};
            events.forEach(event => {
              if (event.date) {
                try {
                  const date = new Date(event.date.split('.').reverse().join('-'));
                  const monthKey = date.toLocaleDateString('tr-TR', { month: 'short' });
                  eventsByMonth[monthKey] = (eventsByMonth[monthKey] || 0) + 1;
                } catch (e) { }
              }
            });
            visualizationData = {
              type: 'events',
              data: Object.entries(eventsByMonth).map(([month, count]) => ({
                name: month,
                sayı: count
              }))
            };
          }
        }
      }

      // Finalize the streaming message with all post-processed data
      setMessages(prev => prev.map(msg =>
        msg.id === typingMsgId
          ? {
              ...msg,
              content: processedResponse,
              isStreaming: false,
              sentiment: sentimentResult,
              visualization: visualizationData,
              anomalies: anomalies.length > 0 ? anomalies.slice(0, 3) : null,
              recommendations: recommendations.length > 0 ? recommendations.slice(0, 3) : null
            }
          : msg
      ));
    } catch (error) {
      console.error('Chat error:', error);
      setError(error.message || 'Mesaj gönderilirken hata oluştu');

      // 402 hatası için özel mesaj
      let errorContent = 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.';
      if (error.message && error.message.includes('402')) {
        errorContent = error.message + '\n\n💡 Çözüm: Ayarlar > Gemini AI sayfasından API anahtarınızı güncelleyebilirsiniz.';
      } else if (error.message) {
        errorContent = error.message;
      }

      // Add error message
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: errorContent
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  // Get welcome message based on user role and current page
  const getWelcomeMessage = (role, pathname) => {
    let baseMessage = 'Merhaba! Ben Yeniden Refah Partisi Elazığ Sekreteri. Size nasıl yardımcı olabilirim?';

    // Role-based customization
    if (role === 'admin') {
      baseMessage = 'Merhaba başkanım! Ben Yeniden Refah Partisi Elazığ Sekreteri. Size nasıl yardımcı olabilirim?';
    } else if (role === 'member') {
      baseMessage = 'Merhaba üyemiz! Ben Yeniden Refah Partisi Elazığ Sekreteri. Size nasıl yardımcı olabilirim?';
    } else if (role === 'chief_observer') {
      baseMessage = 'Merhaba başmüşahit! Ben Yeniden Refah Partisi Elazığ Sekreteri. Size nasıl yardımcı olabilirim?';
    } else if (['provincial_coordinator', 'district_supervisor', 'region_supervisor', 'institution_supervisor'].includes(role)) {
      baseMessage = 'Merhaba sorumlu! Ben Yeniden Refah Partisi Elazığ Sekreteri. Size nasıl yardımcı olabilirim?';
    }

    // Page context
    if (pathname.includes('/meetings')) {
      baseMessage += ' Şu anda toplantılar sayfasındasınız. Toplantılar hakkında sorular sorabilirsiniz.';
    } else if (pathname.includes('/members')) {
      baseMessage += ' Şu anda üyeler sayfasındasınız. Üyeler hakkında sorular sorabilirsiniz.';
    } else if (pathname.includes('/events')) {
      baseMessage += ' Şu anda etkinlikler sayfasındasınız. Etkinlikler hakkında sorular sorabilirsiniz.';
    } else if (pathname.includes('/reports')) {
      baseMessage += ' Şu anda raporlar sayfasındasınız. Raporlar hakkında sorular sorabilirsiniz.';
    }

    baseMessage += '\n\n💡 Hızlı erişim butonlarını kullanarak hızlıca bilgi alabilir veya doğrudan soru sorabilirsiniz.';

    return baseMessage;
  };

  // Quick action handlers
  const handleQuickAction = async (action) => {
    let message = '';

    switch (action) {
      case 'toplantilar':
        message = 'Yaklaşan toplantıları göster';
        break;
      case 'aktif_uyeler':
        message = 'En aktif üyeleri göster';
        break;
      case 'katilim_raporu':
        message = 'Toplantı katılım raporunu göster';
        break;
      case 'etkinlikler':
        message = 'Yaklaşan etkinlikleri göster';
        break;
      case 'istatistikler':
        message = 'Genel istatistikleri göster';
        break;
      case 'toplanti_olustur':
        if (userRole === 'admin') {
          navigate('/meetings?create=true');
          onClose();
          return;
        } else {
          message = 'Toplantı oluşturma yetkiniz yok. Lütfen admin ile iletişime geçin.';
        }
        break;
      case 'uye_ara':
        message = 'Üye arama özelliği. Hangi üyeyi arıyorsunuz?';
        break;
      case 'rapor_goster':
        navigate('/reports');
        onClose();
        return;
      case 'yardim':
        message = 'Yardım: Nasıl kullanılır? Komutlar nelerdir?';
        break;
      default:
        message = action;
    }

    setInput(message);
    setShowQuickActions(false);
    // Auto send after a short delay
    setTimeout(() => {
      const event = new Event('submit', { bubbles: true, cancelable: true });
      const form = document.querySelector('form[onsubmit]');
      if (form) {
        form.dispatchEvent(event);
      }
    }, 100);
  };

  // Predefined questions
  const predefinedQuestions = [
    { id: 'toplantilar', label: '📅 Yaklaşan Toplantılar', action: 'toplantilar' },
    { id: 'aktif_uyeler', label: '⭐ En Aktif Üyeler', action: 'aktif_uyeler' },
    { id: 'katilim_raporu', label: '📊 Katılım Raporu', action: 'katilim_raporu' },
    { id: 'etkinlikler', label: '🎉 Yaklaşan Etkinlikler', action: 'etkinlikler' },
    { id: 'istatistikler', label: '📈 Genel İstatistikler', action: 'istatistikler' }
  ];

  // Quick actions based on role
  const getQuickActions = () => {
    const actions = [
      { id: 'toplanti_olustur', label: '➕ Toplantı Oluştur', action: 'toplanti_olustur', roles: ['admin'] },
      { id: 'uye_ara', label: '🔍 Üye Ara', action: 'uye_ara', roles: ['admin', 'member'] },
      { id: 'rapor_goster', label: '📄 Raporlar', action: 'rapor_goster', roles: ['admin'] },
      { id: 'yardim', label: '❓ Yardım', action: 'yardim', roles: ['admin', 'member', 'chief_observer'] }
    ];

    return actions.filter(a => !a.roles || a.roles.includes(userRole));
  };

  // Get proactive suggestions based on data
  const getProactiveSuggestions = (data, role) => {
    if (!data) return null;

    const suggestions = [];

    // Upcoming meetings
    if (data.meetings && data.meetings.length > 0) {
      const now = new Date();
      const upcomingMeetings = data.meetings
        .filter(m => !m.archived && m.date)
        .map(m => {
          try {
            const meetingDate = new Date(m.date.split('.').reverse().join('-'));
            return { ...m, dateObj: meetingDate };
          } catch {
            return null;
          }
        })
        .filter(m => m && m.dateObj > now)
        .sort((a, b) => a.dateObj - b.dateObj)
        .slice(0, 3);

      if (upcomingMeetings.length > 0) {
        suggestions.push(`📅 Yaklaşan ${upcomingMeetings.length} toplantı var:`);
        upcomingMeetings.forEach(m => {
          const dateStr = m.dateObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
          suggestions.push(`   • ${m.name} - ${dateStr}`);
        });
      }
    }

    // Missing attendance data
    if (data.meetings && role === 'admin') {
      const meetingsWithoutAttendance = data.meetings
        .filter(m => !m.archived && (!m.attendees || m.attendees.length === 0))
        .slice(0, 3);

      if (meetingsWithoutAttendance.length > 0) {
        suggestions.push(`\n⚠️ ${meetingsWithoutAttendance.length} toplantıda yoklama eksik:`);
        meetingsWithoutAttendance.forEach(m => {
          suggestions.push(`   • ${m.name}`);
        });
      }
    }

    // Low attendance rate meetings
    if (data.meetings && role === 'admin') {
      const lowAttendanceMeetings = data.meetings
        .filter(m => !m.archived && m.attendees && m.attendees.length > 0)
        .map(m => {
          const attended = m.attendees.filter(a => a.attended).length;
          const rate = (attended / m.attendees.length) * 100;
          return { ...m, attendanceRate: rate };
        })
        .filter(m => m.attendanceRate < 50)
        .sort((a, b) => a.attendanceRate - b.attendanceRate)
        .slice(0, 3);

      if (lowAttendanceMeetings.length > 0) {
        suggestions.push(`\n📉 Düşük katılımlı toplantılar (<%50):`);
        lowAttendanceMeetings.forEach(m => {
          suggestions.push(`   • ${m.name} - %${Math.round(m.attendanceRate)} katılım`);
        });
      }
    }

    // Upcoming events
    if (data.events && data.events.length > 0) {
      const now = new Date();
      const upcomingEvents = data.events
        .filter(e => !e.archived && e.date)
        .map(e => {
          try {
            const eventDate = new Date(e.date.split('.').reverse().join('-'));
            return { ...e, dateObj: eventDate };
          } catch {
            return null;
          }
        })
        .filter(e => e && e.dateObj > now)
        .sort((a, b) => a.dateObj - b.dateObj)
        .slice(0, 3);

      if (upcomingEvents.length > 0) {
        suggestions.push(`\n🎉 Yaklaşan ${upcomingEvents.length} etkinlik var:`);
        upcomingEvents.forEach(e => {
          const dateStr = e.dateObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
          suggestions.push(`   • ${e.name} - ${dateStr}`);
        });
      }
    }

    // Missing election results
    if (data.elections && data.electionResults && role === 'admin') {
      const electionsWithoutResults = data.elections.filter(election => {
        const hasResults = data.electionResults.some(r =>
          String(r.election_id || r.electionId) === String(election.id)
        );
        return !hasResults;
      }).slice(0, 3);

      if (electionsWithoutResults.length > 0) {
        suggestions.push(`\n🗳️ ${electionsWithoutResults.length} seçimde sonuç eksik:`);
        electionsWithoutResults.forEach(e => {
          suggestions.push(`   • ${e.name}`);
        });
      }
    }

    if (suggestions.length === 0) return null;

    return `💡 PROAKTİF ÖNERİLER:\n\n${suggestions.join('\n')}\n\nBu konular hakkında daha fazla bilgi almak için soru sorabilirsiniz.`;
  };

  // Get help message based on user role
  const getHelpMessage = (role) => {
    let helpMessage = `📚 CHATBOT YARDIM REHBERİ\n\n`;

    helpMessage += `🎯 GENEL KULLANIM:\n`;
    helpMessage += `• Doğal dilde sorular sorabilirsiniz\n`;
    helpMessage += `• "Ahmet'in katıldığı toplantılar" gibi sorgular yapabilirsiniz\n`;
    helpMessage += `• "En aktif üyeler" gibi istatistik soruları sorabilirsiniz\n`;
    helpMessage += `• Tüzük hakkında sorular sorabilirsiniz\n\n`;

    helpMessage += `⚡ HIZLI AKSİYONLAR:\n`;
    const quickActions = getQuickActions();
    quickActions.forEach(action => {
      helpMessage += `• ${action.label}\n`;
    });

    helpMessage += `\n💬 ÖNCEDEN TANIMLI SORULAR:\n`;
    predefinedQuestions.forEach(q => {
      helpMessage += `• ${q.label}\n`;
    });

    helpMessage += `\n🔍 ÖRNEK SORULAR:\n`;
    if (role === 'admin') {
      helpMessage += `• "Toplam kaç üye var?"\n`;
      helpMessage += `• "Bu ay kaç toplantı yapıldı?"\n`;
      helpMessage += `• "En yüksek katılımlı toplantı hangisi?"\n`;
      helpMessage += `• "Ahmet'in performans puanı nedir?"\n`;
      helpMessage += `• "Tüzükte üyelik şartları nelerdir?"\n`;
    } else if (role === 'member') {
      helpMessage += `• "Yaklaşan toplantılar neler?"\n`;
      helpMessage += `• "Katıldığım toplantılar hangileri?"\n`;
      helpMessage += `• "Performans puanım nedir?"\n`;
    } else if (role === 'chief_observer') {
      helpMessage += `• "Onay bekleyen seçim sonuçları neler?"\n`;
      helpMessage += `• "Seçim istatistikleri nedir?"\n`;
    } else if (['provincial_coordinator', 'district_supervisor', 'region_supervisor', 'institution_supervisor'].includes(role)) {
      helpMessage += `• "Sorumlu olduğum sandıklar neler?"\n`;
      helpMessage += `• "Seçim sonuçları nasıl?"\n`;
    }

    helpMessage += `\n💡 İPUÇLARI:\n`;
    helpMessage += `• Sorularınızı Türkçe yazabilirsiniz\n`;
    helpMessage += `• "Nasıl", "Neden", "Ne zaman" gibi sorular sorabilirsiniz\n`;
    helpMessage += `• Karşılaştırma soruları sorabilirsiniz (ör: "Geçen ay ile karşılaştır")\n`;
    helpMessage += `• Hızlı aksiyon butonlarını kullanarak daha hızlı bilgi alabilirsiniz\n`;

    return helpMessage;
  };

  // Get role-specific context for training
  const getRoleSpecificContext = (role) => {
    const contexts = [];

    if (role === 'admin') {
      contexts.push(`\n=== ADMIN KULLANICI EĞİTİMİ ===`);
      contexts.push(`Bu kullanıcı admin rolünde. Tüm verilere erişimi var.`);
      contexts.push(`Admin için özel sorular: Toplantı oluşturma, üye yönetimi, raporlar, istatistikler, seçim sonuçları.`);
      contexts.push(`Admin sorularına detaylı ve kapsamlı cevap ver.`);
    } else if (role === 'member') {
      contexts.push(`\n=== ÜYE KULLANICI EĞİTİMİ ===`);
      contexts.push(`Bu kullanıcı üye rolünde. Kendi bilgilerine ve genel bilgilere erişimi var.`);
      contexts.push(`Üye için özel sorular: Kendi performans puanı, katıldığı toplantılar, yaklaşan etkinlikler.`);
      contexts.push(`Üye sorularına samimi ve yardımcı cevap ver.`);
    } else if (role === 'chief_observer') {
      contexts.push(`\n=== BAŞMÜŞAHİT KULLANICI EĞİTİMİ ===`);
      contexts.push(`Bu kullanıcı başmüşahit rolünde. Seçim sonuçları ve onay işlemlerine erişimi var.`);
      contexts.push(`Başmüşahit için özel sorular: Onay bekleyen sonuçlar, seçim istatistikleri, tutanak durumları.`);
      contexts.push(`Başmüşahit sorularına teknik ve detaylı cevap ver.`);
    } else if (['provincial_coordinator', 'district_supervisor', 'region_supervisor', 'institution_supervisor'].includes(role)) {
      contexts.push(`\n=== SORUMLU KULLANICI EĞİTİMİ ===`);
      contexts.push(`Bu kullanıcı sorumlu rolünde. Sorumlu olduğu sandıklar ve seçim sonuçlarına erişimi var.`);
      contexts.push(`Sorumlu için özel sorular: Sorumlu olduğu sandıklar, seçim sonuç girişi, sandık durumları.`);
      contexts.push(`Sorumlu sorularına pratik ve işlevsel cevap ver.`);
    }

    return contexts;
  };

  // Helper function to calculate average attendance
  const calculateAverageAttendance = (meetings) => {
    if (!meetings || meetings.length === 0) return 0;

    let totalRate = 0;
    let count = 0;

    meetings.forEach(meeting => {
      if (meeting.attendees && meeting.attendees.length > 0) {
        const attended = meeting.attendees.filter(a => a.attended).length;
        const rate = (attended / meeting.attendees.length) * 100;
        totalRate += rate;
        count++;
      }
    });

    return count > 0 ? Math.round(totalRate / count) : 0;
  };

  // Handle automatic actions (meeting creation, etc.)
  const handleAutomaticAction = async (actionType, params) => {
    if (actionType === 'create_meeting' && userRole === 'admin') {
      // Navigate to meeting creation page with pre-filled data
      const queryParams = new URLSearchParams();
      if (params.name) queryParams.set('name', params.name);
      if (params.date) queryParams.set('date', params.date);
      if (params.regions) queryParams.set('regions', params.regions.join(','));

      navigate(`/meetings?create=true&${queryParams.toString()}`);
      onClose();
      return true;
    }

    return false;
  };

  // Handle feedback for learning
  const handleFeedback = async (messageId, feedback) => {
    try {
      // Store feedback locally (can be sent to backend later)
      const feedbackData = {
        messageId,
        feedback,
        timestamp: new Date().toISOString(),
        userRole,
        userMessage: messages.find(m => m.id === messageId - 1)?.content || '',
        assistantMessage: messages.find(m => m.id === messageId)?.content || ''
      };

      // Store in localStorage for now (can be sent to backend for analysis)
      const existingFeedback = JSON.parse(localStorage.getItem('chatbot_feedback') || '[]');
      existingFeedback.push(feedbackData);
      localStorage.setItem('chatbot_feedback', JSON.stringify(existingFeedback.slice(-100))); // Keep last 100 feedbacks

      // Show confirmation
      const feedbackMessage = feedback === 'helpful'
        ? '✅ Geri bildiriminiz kaydedildi. Teşekkürler!'
        : '⚠️ Geri bildiriminiz kaydedildi. Daha iyi hizmet verebilmek için çalışıyoruz.';

      // Add a temporary message
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'assistant',
        content: feedbackMessage,
        isFeedback: true
      }]);

      // Remove feedback message after 3 seconds
      setTimeout(() => {
        setMessages(prev => prev.filter(m => !m.isFeedback));
      }, 3000);
    } catch (error) {
      console.error('Error saving feedback:', error);
    }
  };

  const clearChat = () => {
    const welcomeMessage = getWelcomeMessage(userRole, location.pathname);
    setMessages([{
      id: Date.now(),
      role: 'assistant',
      content: welcomeMessage
    }]);
    setShowQuickActions(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-modal flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 p-4 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <h2 className="text-white font-semibold text-lg">Yeniden Refah Partisi Elazığ Sekreteri</h2>
              <p className="text-green-100 text-xs">Site içi bilgiler (üyeler, toplantılar, etkinlikler) ve tüzük hakkında sorular sorabilirsiniz</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowLimitInfo(!showLimitInfo)}
              className="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
              title="API Limit Durumu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </button>
            <button
              onClick={clearChat}
              className="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
              title="Sohbeti Temizle"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Quick Actions & Predefined Questions */}
        {showQuickActions && messages.length <= 1 && (
          <div className="px-4 pt-4 pb-2 border-b border-gray-200">
            <div className="mb-3">
              <p className="text-xs font-semibold text-gray-600 mb-2">⚡ Hızlı Aksiyonlar</p>
              <div className="flex flex-wrap gap-2">
                {getQuickActions().map(action => (
                  <button
                    key={action.id}
                    onClick={() => handleQuickAction(action.action)}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-medium rounded-lg transition-colors"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">💬 Önceden Tanımlı Sorular</p>
              <div className="flex flex-wrap gap-2">
                {predefinedQuestions.map(q => (
                  <button
                    key={q.id}
                    onClick={() => handleQuickAction(q.action)}
                    className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-medium rounded-lg transition-colors"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${message.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                  }`}
              >
                {message.imageUrl && (
                  <img src={message.imageUrl} alt="Gönderilen görsel" className="max-w-full rounded-lg mb-2 max-h-48 object-contain" />
                )}
                <p className="text-sm whitespace-pre-wrap">{message.content}{message.isStreaming && <span className="inline-block w-1.5 h-4 ml-0.5 bg-current align-middle animate-pulse" />}</p>

                {/* Görselleştirme: Grafikler */}
                {message.role === 'assistant' && message.visualization && (
                  <div className="mt-4 p-3 bg-white rounded-lg border border-gray-200">
                    {message.visualization.type === 'attendance' && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-700 mb-2">📊 Toplantı Katılım Grafiği</h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={message.visualization.data}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip />
                            <Bar dataKey="katılım" fill="#6366f1" radius={[8, 8, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    {message.visualization.type === 'performance' && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-700 mb-2">⭐ Üye Performans Grafiği</h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={message.visualization.data}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip />
                            <Bar dataKey="puan" fill="#10b981" radius={[8, 8, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    {message.visualization.type === 'events' && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-700 mb-2">🎉 Etkinlik Dağılımı</h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={message.visualization.data}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip />
                            <Bar dataKey="sayı" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                )}

                {/* Anomali ve Öneriler */}
                {message.role === 'assistant' && (message.anomalies || message.recommendations) && (
                  <div className="mt-4 space-y-2">
                    {message.anomalies && message.anomalies.length > 0 && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <h4 className="text-xs font-semibold text-amber-800 mb-2">⚠️ Tespit Edilen Anomaliler</h4>
                        {message.anomalies.map((anomaly, idx) => (
                          <div key={idx} className="text-xs text-amber-700 mb-1">
                            • {anomaly.message}
                          </div>
                        ))}
                      </div>
                    )}
                    {message.recommendations && message.recommendations.length > 0 && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <h4 className="text-xs font-semibold text-blue-800 mb-2">💡 Öneriler</h4>
                        {message.recommendations.map((rec, idx) => (
                          <div key={idx} className="text-xs text-blue-700 mb-2">
                            <div className="font-medium">{rec.title}</div>
                            <div className="text-blue-600">{rec.description}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Render links in assistant messages */}
                {message.role === 'assistant' && message.content.includes('[') && (
                  <div className="mt-2 space-y-1">
                    {message.content.match(/\[([^\]]+)\]\(([^)]+)\)/g)?.map((link, idx) => {
                      const match = link.match(/\[([^\]]+)\]\(([^)]+)\)/);
                      if (match) {
                        const [, label, path] = match;
                        return (
                          <button
                            key={idx}
                            onClick={() => {
                              if (path.startsWith('/')) {
                                navigate(path);
                                onClose();
                              }
                            }}
                            className="block w-full text-left px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-xs transition-colors"
                          >
                            {label}
                          </button>
                        );
                      }
                      return null;
                    })}
                  </div>
                )}
                {/* Feedback buttons for assistant messages */}
                {message.role === 'assistant' && !message.isProactive && (
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => handleFeedback(message.id, 'helpful')}
                      className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1"
                      title="Yararlı"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                      </svg>
                      Yararlı
                    </button>
                    <button
                      onClick={() => handleFeedback(message.id, 'not_helpful')}
                      className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                      title="Yararsız"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                      </svg>
                      Yararsız
                    </button>
                    {/* Duygu göstergesi */}
                    {message.sentiment && (
                      <span className="text-xs text-gray-500 ml-auto" title={`Duygu: ${message.sentiment.emotion}, Sentiment: ${message.sentiment.sentiment}`}>
                        {message.sentiment.sentiment === 'positive' && '😊'}
                        {message.sentiment.sentiment === 'negative' && '😔'}
                        {message.sentiment.sentiment === 'neutral' && '😐'}
                        {message.sentiment.sentiment === 'curious' && '🤔'}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl px-4 py-3">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Error message */}
        {error && (
          <div className="px-4 py-2 bg-red-50 border-l-4 border-red-500">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* API Limit Info Modal */}
        {showLimitInfo && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-10 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">API Limit Durumu</h3>
                <button
                  onClick={() => setShowLimitInfo(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-3">
                    <strong>Mevcut Servis:</strong> Gemini
                  </p>
                  <p className="text-xs text-gray-500 mb-4">
                    API limitlerini kontrol etmek için aşağıdaki dashboard linklerini kullanabilirsiniz:
                  </p>

                  <div className="space-y-2">
                    <a
                      href="https://aistudio.google.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-blue-900">Google AI Studio</span>
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </div>
                      <p className="text-xs text-blue-700 mt-1">Gemini API kullanım ve limit bilgileri</p>
                    </a>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-800">
                    <strong>Not:</strong> Limit aşıldığında 402 hatası alırsınız. Bu durumda Ayarlar {'>'} Gemini AI sayfasından API anahtarınızı güncelleyebilirsiniz.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSend} className="p-4 border-t border-gray-200">
          <div className="flex space-x-2">
            {/* Image upload button */}
            <label className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer transition-colors flex items-center">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
                disabled={loading}
              />
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </label>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Mesajınızı yazın..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Chatbot;

