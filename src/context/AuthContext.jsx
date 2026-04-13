import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../services/firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
const [role, setRole] = useState(null);
const [empresaId, setEmpresaId] = useState(null);
const [sedeId, setSedeId] = useState(null);
const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
  try {
    const tokenResult = await firebaseUser.getIdTokenResult();
    const claims = tokenResult.claims;

    if (claims.role !== "superadmin" && claims.empresaId) {
      const snapEmp = await getDoc(doc(db, "empresas", claims.empresaId));
      if (snapEmp.exists() && snapEmp.data().activa === false) {
        await signOut(auth);
        setUser(null); setRole(null); setEmpresaId(null); setSedeId(null);
        return;
      }
    }

    setRole(claims.role || null);
    setEmpresaId(claims.empresaId || null);
    setSedeId(claims.sedeId || null);
    setUser(firebaseUser);
  } finally {
    setLoading(false);
  }
} else {
  setUser(null);
  setRole(null);
  setEmpresaId(null);
  setSedeId(null);
  setLoading(false);
}
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, empresaId, sedeId, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
} 
