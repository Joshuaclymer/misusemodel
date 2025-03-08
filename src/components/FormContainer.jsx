import React from 'react';

const FormContainer = ({ title, children, tooltipDescription }) => {
  return (
    <div style={{ 
      display: "flex", 
      flexDirection: "column", 
      alignItems: "center", 
      marginBottom: "10px", 
      width: "fit-content" 
    }}>
      <h4 style={{ 
        textAlign: "center", 
        marginBottom: "10px", 
        marginTop: "0px", 
        fontSize: "14px", 
        color: "#1a2a3a", 
        fontWeight: "500",
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        justifyContent: 'center',
        width: '100%'
      }}>
        <span>{title}</span>
        {tooltipDescription && (
          <div className="info-icon-tooltip" style={{ flexShrink: 0 }}>
            i
            <span className="tooltip">
              {tooltipDescription}
            </span>
          </div>
        )}
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
