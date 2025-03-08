import React from 'react';

const BlueBox = ({ children }) => {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#e3f2fd", // Light blue background
        // borderRadius: "8px",
        // padding: "20px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        flex: 1,
      }}
    >
      {children}
    </div>
  );
};

export default BlueBox;
