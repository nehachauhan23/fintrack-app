import React from "react";

const MainLayout = ({ children }) => {
  return (
    <div className="container mx-auto mt-20 py-8 max-w-7xl">
      {children}
    </div>
  );
};

export default MainLayout;
