import React from 'react';

const FormContainer = ({ title, children }) => {
  return (
    <div style={{ 
      display: "flex", 
      flexDirection: "column", 
      alignItems: "center", 
      marginBottom: "10px", 
      width: "fit-content" 
    }}>
      <h4 style={{ 
        textAlign: "left", 
        marginBottom: "10px", 
        marginTop: "0px", 
        fontSize: "14px", 
        color: "#1a2a3a", 
        fontWeight: "500" 
      }}>
        {title}
      </h4>
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        width: "100%"
      }}>
        {children}
      </div>
    </div>
  );
};

export default FormContainer;
