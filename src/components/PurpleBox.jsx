import React from 'react';

const PurpleBox = ({ children }) => {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#f3e5f5", // Light purple background
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "20px",
        flex: 1,
      }}
    >
      {children}
    </div>
  );
};

export default PurpleBox;
