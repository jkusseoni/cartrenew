"use client";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Send } from "lucide-react";
import { trackMetaCapiEvent } from "@/lib/meta-capi-client";

gsap.registerPlugin(ScrollTrigger);

interface ActivityLog {
  id: number;
  timestamp: string;
  message: string;
  status: "success" | "error" | "info";
}

export default function DashboardPreview() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [customerName, setCustomerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [cartUrl, setCartUrl] = useState("");
  const [cartAmount, setCartAmount] = useState("");
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState({ recovered: 0, messages: 0, health: 0 });
  const logContainerRef = useRef<HTMLDivElement>(null);

  const addLog = (message: string, status: "success" | "error" | "info") => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const newLog: ActivityLog = { id: Date.now(), timestamp, message, status };
    setLogs((prev) => [...prev, newLog]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !phoneNumber || !cartAmount) {
      addLog("Error: Please fill all required fields", "error");
      return;
    }

    addLog(`Triggered recovery for ${customerName} (${phoneNumber})`, "info");
    const cartValue = Number(cartAmount || 0);
    const trackingCartId = cartUrl || `manual-cart-${Date.now()}`;

    try {
      await trackMetaCapiEvent({
        eventName: "AddToCart",
        value: cartValue,
        currency: "INR",
        userPhone: phoneNumber,
        checkoutUrl: cartUrl || undefined,
        cartId: trackingCartId,
        items: [
          {
            id: trackingCartId,
            title: `${customerName} cart recovery`,
            price: cartValue,
            quantity: 1,
          },
        ],
      });
      addLog("Meta CAPI AddToCart event sent", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Meta CAPI event failed";
      addLog(`Meta CAPI error: ${message}`, "error");
    }

    setTimeout(() => {
      addLog(`WhatsApp message sent to ${phoneNumber}`, "success");
      setStats((prev) => ({
        recovered: prev.recovered + cartValue,
        messages: prev.messages + 1,
        health: Math.min(100, prev.health + 5),
      }));
    }, 800);

    setTimeout(() => {
      addLog(`Follow-up scheduled for ${customerName}`, "success");
    }, 1600);
  };

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".dash-stat",
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          stagger: 0.1,
          ease: "power2.out",
          scrollTrigger: { trigger: sectionRef.current, start: "top 80%", once: true },
        }
      );
      gsap.fromTo(
        ".dash-panel-left",
        { opacity: 0, x: -30 },
        {
          opacity: 1,
          x: 0,
          duration: 0.6,
          ease: "power2.out",
          scrollTrigger: { trigger: sectionRef.current, start: "top 70%", once: true },
        }
      );
      gsap.fromTo(
        ".dash-panel-right",
        { opacity: 0, x: 30 },
        {
          opacity: 1,
          x: 0,
          duration: 0.6,
          ease: "power2.out",
          scrollTrigger: { trigger: sectionRef.current, start: "top 70%", once: true },
        }
      );
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section id="dashboard" ref={sectionRef} className="pb-[120px]">
      <div className="max-w-[900px] mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-10">
          <h2
            className="font-bold tracking-[-0.03em] gradient-text"
            style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
          >
            CartRenew Advanced Dashboard
          </h2>
          <p className="text-lg text-[var(--text-secondary)] mt-3">
            Manage recovery workflows, monitor logs, and trigger sequences.
          </p>
        </div>

        {/* Stats Bar */}
        <div className="grid md:grid-cols-3 gap-6 mb-6">
          <div
            className="dash-stat rounded-2xl p-6"
            style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <p className="label-mono mb-2">TOTAL RECOVERED PIPELINE</p>
            <p className="text-3xl font-bold" style={{ color: "var(--accent-emerald)", fontFamily: "JetBrains Mono Variable, monospace" }}>
              ₹{stats.recovered.toLocaleString("en-IN")}.00
            </p>
          </div>
          <div
            className="dash-stat rounded-2xl p-6"
            style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <p className="label-mono mb-2">MESSAGES SENT</p>
            <p className="text-3xl font-bold text-white" style={{ fontFamily: "JetBrains Mono Variable, monospace" }}>
              {stats.messages}
            </p>
          </div>
          <div
            className="dash-stat rounded-2xl p-6"
            style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <p className="label-mono mb-2">PIPELINE HEALTH RATE</p>
            <p className="text-3xl font-bold" style={{ color: "var(--accent-cyan)", fontFamily: "JetBrains Mono Variable, monospace" }}>
              {stats.health}%
            </p>
          </div>
        </div>

        {/* Main Dashboard Content */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left Panel — Manual Cart Recovery Trigger */}
          <div
            className="dash-panel-left rounded-2xl p-7"
            style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <h3 className="text-xl font-bold text-white">Manual Cart Recovery Trigger</h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Test your localized Hinglish recovery engine sequence instantly.
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="label-mono block mb-1.5">Customer Name</label>
                <input
                  type="text"
                  className="input-dark"
                  placeholder="e.g., Rahul Kumar"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
              <div>
                <label className="label-mono block mb-1.5">Phone Number</label>
                <input
                  type="text"
                  className="input-dark"
                  placeholder="e.g., 919755612850"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>
              <div>
                <label className="label-mono block mb-1.5">Abandon Cart URL</label>
                <input
                  type="text"
                  className="input-dark"
                  placeholder="https://cartrenew.vercel.app/cart/123"
                  value={cartUrl}
                  onChange={(e) => setCartUrl(e.target.value)}
                />
              </div>
              <div>
                <label className="label-mono block mb-1.5">Cart Total Amount (INR)</label>
                <input
                  type="number"
                  className="input-dark"
                  placeholder="e.g., 1499"
                  value={cartAmount}
                  onChange={(e) => setCartAmount(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-3.5 rounded-[10px] text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all duration-200 hover:opacity-90"
                style={{ background: "#2563EB" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#1D4ED8")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#2563EB")}
              >
                <Send size={16} />
                Send WhatsApp Recovery Sequence
              </button>
            </form>
          </div>

          {/* Right Panel — Live Activity Stream */}
          <div
            className="dash-panel-right rounded-2xl p-7"
            style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <h3 className="text-xl font-bold text-white">Live Activity Stream</h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Latest execution logs in this session.
            </p>

            <div
              ref={logContainerRef}
              className="mt-4 rounded-xl p-4 min-h-[260px] max-h-[420px] overflow-y-auto"
              style={{ background: "rgba(0,0,0,0.2)" }}
            >
              {logs.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)] text-center mt-20">
                  No sequences triggered yet. Use the form to fire a test payload.
                </p>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3">
                      <span
                        className="text-xs mt-0.5 flex-shrink-0"
                        style={{ color: "var(--text-tertiary)", fontFamily: "JetBrains Mono Variable, monospace" }}
                      >
                        {log.timestamp}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{
                            background:
                              log.status === "success"
                                ? "var(--success)"
                                : log.status === "error"
                                ? "var(--error)"
                                : "var(--warning)",
                          }}
                        />
                        <span className="text-sm text-[var(--text-secondary)]">{log.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
