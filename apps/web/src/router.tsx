import { createBrowserRouter } from "react-router-dom";

import Login from "./pages/Login";

import AdminLayout from "./layouts/AdminLayout";
import AdminHome from "./pages/admin/AdminHome";
import AdminSubpage from "./pages/admin/AdminSubpage";

import BuyerLayout from "./layouts/BuyerLayout";
import BuyerHome from "./pages/buyer/BuyerHome";
import BuyerSubpage from "./pages/buyer/BuyerSubpage";

import SellerLayout from "./layouts/SellerLayout";
import SellerHome from "./pages/seller/SellerHome";
import SellerSubpage from "./pages/seller/SellerSubpage";

export const router = createBrowserRouter([
  { path: "/", element: <Login /> },
  { path: "/login", element: <Login /> },

  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      { index: true, element: <AdminHome /> },
      { path: "subpage", element: <AdminSubpage /> },
    ],
  },

  {
    path: "/buyer",
    element: <BuyerLayout />,
    children: [
      { index: true, element: <BuyerHome /> },
      { path: "subpage", element: <BuyerSubpage /> },
    ],
  },

  {
    path: "/seller",
    element: <SellerLayout />,
    children: [
      { index: true, element: <SellerHome /> },
      { path: "subpage", element: <SellerSubpage /> },
    ],
  },
]);
