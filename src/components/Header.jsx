import { useEffect, useState } from "react";
import logo from "../assets/logo-perritos-guao.png";

export default function Header({ view, setView, pendingCount }) {
  const [clock, setClock] = useState("");

  useEffect(() => {
    function tick() {
      const now = new Date();
      setClock(
        now.toLocaleDateString("es-VE", { weekday: "long", day: "numeric", month: "long" }) +
        " · " + now.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })
      );
    }
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <header>
      <div className="brand">
          <img src={logo} alt="Perritos Guao" className="logo-img" />
        <div>
          <h1>PUNTO&nbsp;PEDIDO</h1>
          <span className="tag">Panel interno · no visible al cliente</span>
        </div>
      </div>
      <nav className="tabs">
        <button className={view === "order" ? "active" : ""} onClick={() => setView("order")}>
          Tomar pedido
        </button>
        <button className={view === "board" ? "active" : ""} onClick={() => setView("board")}>
          Pedidos activos {pendingCount > 0 && `(${pendingCount})`}
        </button>
        <button className={view === "cash" ? "active" : ""} onClick={() => setView("cash")}>
          Cierre de caja
        </button>
      </nav>
      <div className="clock">{clock}</div>
    </header>
  );
}
