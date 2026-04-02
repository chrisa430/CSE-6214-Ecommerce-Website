import { createBrowserRouter, Navigate } from "react-router-dom";

import Login    from "./pages/Login";
import Register from "./pages/Register";

import AdminLayout   from "./layouts/AdminLayout";
import AdminHome     from "./pages/admin/AdminHome";
import AdminSubpage  from "./pages/admin/AdminSubpage";
import AdminProducts      from "./pages/admin/AdminProducts";
import AdminProductDetail from "./pages/admin/AdminProductDetail";
import AdminOrders        from "./pages/admin/AdminOrders";

import BuyerLayout   from "./layouts/BuyerLayout";
import BuyerHome     from "./pages/buyer/BuyerHome";
import BuyerSubpage  from "./pages/buyer/BuyerSubpage";
import BuyerCart from "./pages/buyer/BuyerCart";
import BuyerCheckout from "./pages/buyer/BuyerCheckout";
import BuyerProfile from "./pages/buyer/BuyerProfile";
import BuyerOrders from "./pages/buyer/BuyerOrders";
import BuyerOrderDetail from "./pages/buyer/BuyerOrderDetail";
import BuyerReturns from "./pages/buyer/BuyerReturns";

import SellerLayout  from "./layouts/SellerLayout";
import SellerHome    from "./pages/seller/SellerHome";
import SellerSubpage from "./pages/seller/SellerSubpage";
import InventoryManagement from "./pages/seller/InventoryManagement";
import SellerProfile from "./pages/seller/SellerProfile";
import SellerReturns from "./pages/seller/SellerReturns";

export const router = createBrowserRouter([
  { path: "/",        element: <Navigate to="/login" replace /> },
  { path: "/login",   element: <Login /> },
  { path: "/register",element: <Register /> },

  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      { index: true,          element: <AdminHome /> },
      { path: "subpage",      element: <AdminSubpage /> },
      { path: "products",         element: <AdminProducts /> },
      { path: "products/:id",     element: <AdminProductDetail /> },
      { path: "orders",            element: <AdminOrders /> },
    ],
  },

  {
    path: "/buyer",
    element: <BuyerLayout />,
    children: [
      { index: true,          element: <BuyerHome /> },
      { path: "subpage",      element: <BuyerSubpage /> },
      { path: "cart", element: <BuyerCart /> },
      { path: "checkout", element: <BuyerCheckout /> },
      { path: "profile", element: <BuyerProfile /> },
      { path: "orders",             element: <BuyerOrders /> },
      { path: "orders/:orderId",    element: <BuyerOrderDetail /> },
      { path: "returns",            element: <BuyerReturns /> },
    ],
  },

  {
    path: "/seller",
    element: <SellerLayout />,
    children: [
      { index: true,          element: <SellerHome /> },
      { path: "subpage",      element: <SellerSubpage /> },
      { path: "inventory", element: <InventoryManagement /> },
      { path: "profile",   element: <SellerProfile /> },
      { path: "returns",   element: <SellerReturns /> },
    ],
  },
]);
