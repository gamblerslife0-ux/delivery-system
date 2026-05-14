import { useEffect } from "react";

export default function App() {
  useEffect(() => {
    console.log("APP LOADED");

    fetch("https://delivery-system-urqq.onrender.com/health")
      .then((res) => res.json())
      .then((data) => {
        console.log("BACKEND RESPONSE:", data);
      })
      .catch((err) => {
        console.log("ERROR:", err);
      });
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>DELIVERY SYSTEM</h1>
      <p>Frontend is working ✔</p>
    </div>
  );
}