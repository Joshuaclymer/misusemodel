import React from 'react';

const OrangeBox = ({ children }) => {
  return (
    <div
      style={{
        width: "100%",
        // minHeight: "100%",
        backgroundColor: "#fff3e0", // Light orange background
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        // flex: 1,
      }}
    >
      {children}
    </div>
  );
};

export default OrangeBox;
