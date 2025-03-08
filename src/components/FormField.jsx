import React, { useEffect, useState } from "react";

const FormField = ({
  label,
  value,
  onChange,
  onSubmit,
  min,
  max,
  width = Math.min(Math.max(60, window.innerWidth * 0.08), 100) + "px",
  labelWidth = "250px",
  type = "number",
}) => {
  const [innerWidth, setInnerWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => {
      setInnerWidth(window.innerWidth);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const calculatedWidth = Math.min(Math.max(60, innerWidth * 0.08), 100) + "px";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
      }}
    >
      <label
        style={{
          fontSize: "12px",
          fontWeight: "500",
          color: "#1a2a3a",
          width: labelWidth,
          textAlign: "left",
        }}
      >
        {label}
      </label>
      <div style={{ width: "clamp(60px, 8vw, 100px)" }}>
        <input
          type={type}
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const value =
              e.target.value === ""
                ? ""
                : type === "number"
                ? parseFloat(e.target.value)
                : e.target.value;
            onChange(value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && onSubmit) {
              e.preventDefault();
              const value =
                e.target.value === ""
                  ? 0
                  : type === "number"
                  ? parseFloat(e.target.value)
                  : e.target.value;
              onSubmit(value);
            }
          }}
          style={{
            width: "100%",
            padding: "6px 8px",
            fontSize: "12px",
            border: "2px solid #e8e8e8",
            borderRadius: "6px",
            outline: "none",
            backgroundColor: "white",
            color: "#1a2a3a",
            transition: "all 0.2s ease",
            cursor: "pointer",
            boxShadow: "0 2px 4px rgba(194, 226, 249, 0.1)",
          }}
        />
      </div>
    </div>
  );
};

export default FormField;
