import React from 'react';

const Card = ({ children, style }) => {
  return (
    <div 
      style={{ 
        display: "flex", 
        flexDirection: "column", 
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FBFBFB",
        borderRadius: "8px",
        // padding: "clamp(10px, 2vw, 20px)",
        margin: "clamp(5px, 1vw, 10px)",
        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
        ...style
      }}
    >
      {children}
    </div>
  );
};

export default Card;
