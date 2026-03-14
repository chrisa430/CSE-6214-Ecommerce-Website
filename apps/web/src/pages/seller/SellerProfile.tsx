import { useState } from "react";
import { useAuth } from "../../context/AuthContext";

export default function SellerProfile() {
  const { user } = useAuth();

  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [message, setMessage] = useState("");

  async function handleSave() {
    try {
      const res = await fetch("/api/accounts/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify({ firstName, lastName }),
      });

      if (!res.ok) {
        throw new Error("Update failed");
      }

      setMessage("Profile updated successfully.");
    } catch (err) {
      console.error(err);
      setMessage("Failed to update profile.");
    }
  }

  return (
    <div className="card cardPad">
      <div className="h2">Account Profile</div>

      <div style={{ marginTop: 20 }}>
        <label>Email</label>
        <input
          className="input"
          value={user?.email || ""}
          disabled
        />

        <label style={{ marginTop: 10, display: "block" }}>First Name</label>
        <input
          className="input"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />

        <label style={{ marginTop: 10, display: "block" }}>Last Name</label>
        <input
          className="input"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />

        <button
          className="btn btnPrimary"
          style={{ marginTop: 14 }}
          //onClick={handleSave}
        >
          Save Changes
        </button>

        {message && (
          <div style={{ marginTop: 10 }}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}