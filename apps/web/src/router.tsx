import { createBrowserRouter, Navigate } from "react-router-dom";

import Login    from "./pages/Login";
import Register from "./pages/Register";

import AdminLayout        from "./layouts/AdminLayout";
import AdminHome          from "./pages/admin/AdminHome";
import AdminSubpage       from "./pages/admin/AdminSubpage";
import AdminProducts      from "./pages/admin/AdminProducts";
import AdminProductDetail from "./pages/admin/AdminProductDetail";

import BuyerLayout   from "./layouts/BuyerLayout";
import BuyerHome     from "./pages/buyer/BuyerHome";
import BuyerSubpage  from "./pages/buyer/BuyerSubpage";

import SellerLayout  from "./layouts/SellerLayout";
import SellerHome    from "./pages/seller/SellerHome";
import SellerSubpage from "./pages/seller/SellerSubpage";

export const router = createBrowserRouter([
  { path: "/",        element: <Navigate to="/login" replace /> },
  { path: "/login",   element: <Login /> },
  { path: "/register",element: <Register /> },

  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      { index: true,              element: <AdminHome /> },
      { path: "subpage",          element: <AdminSubpage /> },
      { path: "products",         element: <AdminProducts /> },
      { path: "products/:id",     element: <AdminProductDetail /> },
    ],
  },

  {
    path: "/buyer",
    element: <BuyerLayout />,
    children: [
      { index: true,          element: <BuyerHome /> },
      { path: "subpage",      element: <BuyerSubpage /> },
    ],
  },

  {
    path: "/seller",
    element: <SellerLayout />,
    children: [
      { index: true,          element: <SellerHome /> },
      { path: "subpage",      element: <SellerSubpage /> },
    ],
  },
]);
