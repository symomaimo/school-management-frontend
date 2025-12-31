// src/components/nav/SmartLink.jsx
import { Link, useLocation } from "react-router-dom";

export default function SmartLink({ to, state, preserveSearch = true, preserveHash = true, ...rest }) {
  const location = useLocation();
  const from =
    location.pathname +
    (preserveSearch ? location.search : "") +
    (preserveHash ? location.hash : "");
  return <Link to={to} state={{ from, ...state }} {...rest} />;
}
