/**
 * LandingPage.jsx
 * SIGRQ — Landing page pública
 * Ruta: /
 */

import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

export default function LandingPage() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setVisible(true), 100);
  }, []);

  return (
    <div style={{ fontFamily: "'Georgia', 'Times New Roman', serif", background: "#0a0f1e", minHeight: "100vh", color: "#e8edf5", overflowX: "hidden" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Source+Sans+3:wght@300;400;600&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .landing { font-family: 'Source Sans 3', sans-serif; }
        .display { font-family: 'Playfair Display', serif; }

        .fade-up {
          opacity: 0;
          transform: translateY(32px);
          transition: opacity 0.8s ease, transform 0.8s ease;
        }
        .fade-up.visible {
          opacity: 1;
          transform: translateY(0);
        }
        .delay-1 { transition-delay: 0.15s; }
        .delay-2 { transition-delay: 0.3s; }
        .delay-3 { transition-delay: 0.45s; }
        .delay-4 { transition-delay: 0.6s; }

        .btn-primary {
          background: #1d4ed8;
          color: #fff;
          border: none;
          padding: 14px 32px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          letter-spacing: 0.5px;
          transition: background 0.2s, transform 0.15s;
          font-family: 'Source Sans 3', sans-serif;
        }
        .btn-primary:hover { background: #1e40af; transform: translateY(-1px); }

        .btn-ghost {
          background: transparent;
          color: #93b4d8;
          border: 1px solid #1e3a5f;
          padding: 13px 28px;
          font-size: 15px;
          font-weight: 400;
          cursor: pointer;
          letter-spacing: 0.3px;
          transition: border-color 0.2s, color 0.2s;
          font-family: 'Source Sans 3', sans-serif;
        }
        .btn-ghost:hover { border-color: #3b82f6; color: #bdd5f0; }

        .feature-card {
          background: #111827;
          border: 1px solid #1e2d45;
          padding: 32px;
          transition: border-color 0.2s, transform 0.2s;
        }
        .feature-card:hover { border-color: #2d4a7a; transform: translateY(-3px); }

        .plan-card {
          background: #0d1626;
          border: 1px solid #1e2d45;
          padding: 36px 28px;
          position: relative;
          transition: border-color 0.2s;
        }
        .plan-card:hover { border-color: #3b5a8a; }
        .plan-card.featured {
          border-color: #1d4ed8;
          background: #0f1e3d;
        }
        .plan-badge {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          background: #1d4ed8;
          color: #fff;
          font-size: 11px;
          font-weight: 600;
          padding: 4px 14px;
          letter-spacing: 1px;
          text-transform: uppercase;
          font-family: 'Source Sans 3', sans-serif;
        }

        .divider {
          width: 48px;
          height: 2px;
          background: #1d4ed8;
          margin: 16px 0 24px;
        }

        .step-number {
          width: 40px;
          height: 40px;
          border: 1px solid #1d4ed8;
          color: #3b82f6;
          font-size: 16px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-family: 'Playfair Display', serif;
        }

        .tag {
          display: inline-block;
          background: #0f2144;
          color: #60a5fa;
          font-size: 11px;
          font-weight: 600;
          padding: 4px 12px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          border: 1px solid #1e3a6e;
          margin-bottom: 20px;
          font-family: 'Source Sans 3', sans-serif;
        }

        .metric-box {
          border-left: 2px solid #1d4ed8;
          padding-left: 20px;
        }

        nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 100;
          background: rgba(10, 15, 30, 0.92);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid #1a2540;
          padding: 0 40px;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .nav-logo {
          font-family: 'Playfair Display', serif;
          font-size: 22px;
          font-weight: 700;
          color: #e8edf5;
          letter-spacing: 1px;
        }
        .nav-logo span { color: #3b82f6; }

        @media (max-width: 768px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .features-grid { grid-template-columns: 1fr !important; }
          .plans-grid { grid-template-columns: 1fr !important; }
          .steps-grid { grid-template-columns: 1fr !important; }
          .metrics-grid { grid-template-columns: 1fr 1fr !important; }
          nav { padding: 0 20px; }
          .nav-cta { display: none; }
        }
      `}</style>

      {/* NAV */}
      <nav className="landing">
        <div className="nav-logo display">SIGRQ<span>.</span></div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }} className="nav-cta">
          <button className="btn-ghost" onClick={() => navigate("/login")} style={{ padding: "9px 20px", fontSize: 14 }}>
            Iniciar sesión
          </button>
          <button className="btn-primary" onClick={() => navigate("/registro")} style={{ padding: "9px 20px", fontSize: 14 }}>
            Prueba gratis
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ minHeight: "100vh", display: "flex", alignItems: "center", padding: "100px 40px 80px", maxWidth: 1100, margin: "0 auto" }}>
        <div className={`hero-grid fade-up ${visible ? "visible" : ""}`} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center", width: "100%" }}>
          <div>
            <div className="tag landing">Normativa colombiana</div>
            <h1 className="display" style={{ fontSize: "clamp(36px, 5vw, 58px)", lineHeight: 1.15, fontWeight: 900, marginBottom: 24, color: "#f0f4fc" }}>
              Gestión de riesgos químicos para la industria colombiana
            </h1>
            <p className="landing" style={{ fontSize: 17, color: "#7a9cbf", lineHeight: 1.75, marginBottom: 36, fontWeight: 300 }}>
              Evalúa el riesgo de tus sustancias químicas en minutos con metodología OIT/BAuA validada. Cumple el Decreto 1072 y la Resolución 0312 sin contratar un consultor para cada evaluación.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button className="btn-primary landing" onClick={() => navigate("/registro")}>
                Comenzar gratis — 5 evaluaciones
              </button>
              <button className="btn-ghost landing" onClick={() => navigate("/login")}>
                Ya tengo cuenta
              </button>
            </div>
            <p className="landing" style={{ marginTop: 16, fontSize: 13, color: "#3d5a7a" }}>
              Sin tarjeta de crédito · Sin instalación · Listo en 2 minutos
            </p>
          </div>

          {/* Panel decorativo */}
          <div className={`fade-up delay-2 ${visible ? "visible" : ""}`} style={{ background: "#0d1626", border: "1px solid #1e2d45", padding: 28 }}>
            <div style={{ fontSize: 11, color: "#3d5a7a", letterSpacing: 2, textTransform: "uppercase", marginBottom: 20, fontFamily: "'Source Sans 3', sans-serif" }}>
              Resultado de evaluación — Tolueno
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              {[
                { label: "Inhalación", value: "Nivel 3", color: "#f97316", bg: "#1c1009" },
                { label: "Piel", value: "Alto", color: "#ef4444", bg: "#1c0909" },
                { label: "Fuego", value: "Moderado", color: "#eab308", bg: "#1a1600" },
                { label: "EPR", value: "Filtro AX", color: "#3b82f6", bg: "#091529" },
              ].map((item, i) => (
                <div key={i} style={{ background: item.bg, border: `1px solid ${item.color}33`, padding: "12px 14px" }}>
                  <div style={{ fontSize: 10, color: "#4a6a8a", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4, fontFamily: "'Source Sans 3', sans-serif" }}>{item.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: item.color, fontFamily: "'Playfair Display', serif" }}>{item.value}</div>
                </div>
              ))}
            </div>
            <div style={{ background: "#0a1525", border: "1px solid #1a2e4a", padding: "10px 14px", fontSize: 12, color: "#4a7aaa", fontFamily: "'Source Sans 3', sans-serif" }}>
              ⚠ Requiere consulta con asesor especializado · EPP: Guante Neopreno
            </div>
          </div>
        </div>
      </section>

      {/* MÉTRICAS */}
      <section style={{ background: "#070d1a", borderTop: "1px solid #111d35", borderBottom: "1px solid #111d35", padding: "48px 40px" }}>
        <div className={`metrics-grid fade-up ${visible ? "visible" : ""}`} style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 32, maxWidth: 1100, margin: "0 auto" }}>
          {[
            { num: "6", label: "Métodos de evaluación", sub: "Inhalación, piel, fuego, nano, EPP, EPR" },
            { num: "EN ISO 374", label: "Selección de guantes", sub: "Norma europea integrada" },
            { num: "EN 14387", label: "Protección respiratoria", sub: "Filtros y cartuchos" },
            { num: "Dec. 1072", label: "Marco normativo", sub: "Resolución 0312 de 2019" },
          ].map((m, i) => (
            <div key={i} className="metric-box">
              <div className="display" style={{ fontSize: 28, fontWeight: 700, color: "#c8dff5", marginBottom: 4 }}>{m.num}</div>
              <div className="landing" style={{ fontSize: 13, fontWeight: 600, color: "#7090b0", marginBottom: 2 }}>{m.label}</div>
              <div className="landing" style={{ fontSize: 12, color: "#3d5a7a" }}>{m.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FUNCIONALIDADES */}
      <section style={{ padding: "96px 40px", maxWidth: 1100, margin: "0 auto" }}>
        <div className={`fade-up ${visible ? "visible" : ""}`} style={{ marginBottom: 56 }}>
          <div className="tag landing">Funcionalidades</div>
          <h2 className="display" style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 700, color: "#dce8f5", maxWidth: 520 }}>
            Todo lo que necesitas en un solo sistema
          </h2>
          <div className="divider" />
        </div>
        <div className={`features-grid fade-up delay-1 ${visible ? "visible" : ""}`} style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {[
            { icon: "⚗️", title: "Extracción automática de FDS", desc: "Sube la ficha de datos de seguridad en PDF y la IA extrae todos los parámetros necesarios para la evaluación." },
            { icon: "🧮", title: "Motor de evaluación EMKG/OIT", desc: "Evaluación de riesgo por inhalación, vía dérmica, incendio y explosión según metodología BAuA/OIT validada." },
            { icon: "🥼", title: "Selección de EPP y EPR", desc: "Recomendación automática de guantes (EN ISO 374) y protección respiratoria (EN 14387) según el perfil de riesgo." },
            { icon: "📊", title: "Dashboard analítico", desc: "Distribución de riesgos por área, alertas de FDS vencidas y sustancias que requieren atención inmediata." },
            { icon: "📋", title: "Reporte de cumplimiento", desc: "Informe PDF listo para auditorías del SGSST conforme al Decreto 1072 y la Resolución 0312 de 2019." },
            { icon: "🏭", title: "Multiárea y multisede", desc: "Organiza tu inventario por áreas de trabajo y sedes con acceso diferenciado por roles para cada usuario." },
          ].map((f, i) => (
            <div key={i} className="feature-card landing">
              <div style={{ fontSize: 28, marginBottom: 14 }}>{f.icon}</div>
              <div className="display" style={{ fontSize: 17, fontWeight: 700, color: "#c8dff5", marginBottom: 10 }}>{f.title}</div>
              <div style={{ fontSize: 14, color: "#5a7a9a", lineHeight: 1.65 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section style={{ background: "#070d1a", borderTop: "1px solid #111d35", padding: "96px 40px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className={`fade-up ${visible ? "visible" : ""}`} style={{ marginBottom: 56 }}>
            <div className="tag landing">Proceso</div>
            <h2 className="display" style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 700, color: "#dce8f5", maxWidth: 480 }}>
              De la FDS al informe en menos de 10 minutos
            </h2>
            <div className="divider" />
          </div>
          <div className={`steps-grid fade-up delay-1 ${visible ? "visible" : ""}`} style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 32 }}>
            {[
              { n: "1", title: "Sube la FDS", desc: "Carga el PDF de la ficha de datos de seguridad de cualquier proveedor." },
              { n: "2", title: "IA extrae los datos", desc: "Claude analiza la FDS y completa automáticamente todos los campos." },
              { n: "3", title: "Evalúa el riesgo", desc: "El motor calcula niveles de riesgo y selecciona el EPP y EPR adecuados." },
              { n: "4", title: "Exporta el informe", desc: "Descarga el reporte PDF firmado listo para el expediente del SGSST." },
            ].map((s, i) => (
              <div key={i} className="landing" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="step-number display">{s.n}</div>
                <div>
                  <div className="display" style={{ fontSize: 16, fontWeight: 700, color: "#c8dff5", marginBottom: 8 }}>{s.title}</div>
                  <div style={{ fontSize: 14, color: "#5a7a9a", lineHeight: 1.65 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANES */}
      <section style={{ padding: "96px 40px", maxWidth: 1100, margin: "0 auto" }}>
        <div className={`fade-up ${visible ? "visible" : ""}`} style={{ marginBottom: 56, textAlign: "center" }}>
          <div className="tag landing">Planes</div>
          <h2 className="display" style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 700, color: "#dce8f5" }}>
            Precios pensados para la PYME colombiana
          </h2>
          <div className="divider" style={{ margin: "16px auto 0" }} />
        </div>
        <div className={`plans-grid fade-up delay-1 ${visible ? "visible" : ""}`} style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
          {[
            { name: "Free", price: "Gratis", period: "", evals: "5 evaluaciones", desc: "Para conocer la plataforma y validar si es lo que necesitas.", featured: false, cta: "Comenzar gratis", action: () => navigate("/registro") },
            { name: "Pequeña", price: "Consultar", period: "/ año", evals: "50 evaluaciones", desc: "Ideal para empresas con inventario químico reducido y una sede.", featured: false, cta: "Escribir por WhatsApp", action: () => window.open("https://wa.me/573007774342?text=Hola%2C%20quiero%20información%20del%20plan%20Pequeña%20de%20SIGRQ.", "_blank") },
            { name: "Mediana", price: "Consultar", period: "/ año", evals: "110 evaluaciones", desc: "Para empresas con múltiples áreas de trabajo y coordinadores HSE.", featured: true, cta: "Escribir por WhatsApp", action: () => window.open("https://wa.me/573007774342?text=Hola%2C%20quiero%20información%20del%20plan%20Mediana%20de%20SIGRQ.", "_blank") },
            { name: "Grande", price: "Consultar", period: "/ año", evals: "Ilimitadas", desc: "Para industrias con alto volumen de sustancias y varias sedes.", featured: false, cta: "Escribir por WhatsApp", action: () => window.open("https://wa.me/573007774342?text=Hola%2C%20quiero%20información%20del%20plan%20Grande%20de%20SIGRQ.", "_blank") },
          ].map((p, i) => (
            <div key={i} className={`plan-card landing ${p.featured ? "featured" : ""}`}>
              {p.featured && <div className="plan-badge">Más elegido</div>}
              <div className="display" style={{ fontSize: 20, fontWeight: 700, color: "#c8dff5", marginBottom: 8 }}>{p.name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                <span className="display" style={{ fontSize: 28, fontWeight: 900, color: p.featured ? "#60a5fa" : "#7090b0" }}>{p.price}</span>
                {p.period && <span style={{ fontSize: 13, color: "#3d5a7a" }}>{p.period}</span>}
              </div>
              <div style={{ fontSize: 13, color: "#3b82f6", fontWeight: 600, marginBottom: 16, letterSpacing: 0.5 }}>{p.evals}</div>
              <div style={{ fontSize: 13, color: "#4a6a8a", lineHeight: 1.65, marginBottom: 24, minHeight: 56 }}>{p.desc}</div>
              <button
                onClick={p.action}
                className={p.featured ? "btn-primary landing" : "btn-ghost landing"}
                style={{ width: "100%", fontSize: 13, padding: "11px 16px" }}>
                {p.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{ background: "#0d1a33", borderTop: "1px solid #1a2d4a", padding: "96px 40px", textAlign: "center" }}>
        <div className={`fade-up ${visible ? "visible" : ""}`} style={{ maxWidth: 580, margin: "0 auto" }}>
          <h2 className="display" style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 900, color: "#e8f0fc", marginBottom: 20, lineHeight: 1.2 }}>
            Empieza hoy con 5 evaluaciones gratuitas
          </h2>
          <p className="landing" style={{ fontSize: 16, color: "#5a7a9a", marginBottom: 36, lineHeight: 1.7 }}>
            Sin contrato, sin tarjeta de crédito. Solo regístrate con el correo de tu empresa y comienza a evaluar riesgos en minutos.
          </p>
          <button className="btn-primary landing" onClick={() => navigate("/registro")} style={{ fontSize: 16, padding: "16px 40px" }}>
            Crear cuenta gratis
          </button>
          <p className="landing" style={{ marginTop: 20, fontSize: 13, color: "#2d4a6a" }}>
            ¿Tienes preguntas?{" "}
            <a href="https://wa.me/573007774342?text=Hola%2C%20quiero%20información%20sobre%20SIGRQ."
              target="_blank" rel="noopener noreferrer"
              style={{ color: "#3b82f6", textDecoration: "none" }}>
              Escríbenos por WhatsApp
            </a>
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: "#070c1a", borderTop: "1px solid #0f1a30", padding: "32px 40px" }}>
        <div className="landing" style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div className="display" style={{ fontSize: 18, fontWeight: 700, color: "#c8dff5", marginBottom: 4 }}>SIGRQ</div>
            <div style={{ fontSize: 12, color: "#2d4a6a" }}>Sistema de Gestión de Riesgos Químicos · Medellín, Colombia</div>
          </div>
          <div style={{ fontSize: 12, color: "#2d4a6a", textAlign: "right" }}>
            <div>jgsaldarriaga@hotmail.com</div>
            <div style={{ marginTop: 4 }}>
              <a href="https://wa.me/573007774342" target="_blank" rel="noopener noreferrer" style={{ color: "#3b82f6", textDecoration: "none" }}>
                +57 300 777 4342
              </a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
