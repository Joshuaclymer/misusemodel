const ParameterSelector = ({ inputParams, setInputParams, refreshPage }) => {
  return (
    <div
        style={{
        display: "flex",
        gap: "20px",
        justifyContent: "flex-start",
        flexWrap: "wrap",
        backgroundColor: "#FBFBFB",
        borderRadius: "8px",
        padding: "20px",
        margin: "clamp(5px, 2vw, 10px)",
        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
        }}
    >
        <div style={{ width: "clamp(280px, 100%, 320px)" }}>
        <div
            style={{
            display: "flex",
            flexDirection: "column",
            gap: "15px",
            }}
        >
            <div
            style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "15px"
            }}
            >
            <label style={{ fontSize: "12px", fontWeight: "500", color: "#1a2a3a", flex: 1, textAlign: "left" }}>Expected Annual Attempts:</label>
            <input
                type="number"
                value={inputParams.expectedAnnualAttempts}
                onChange={(e) => {
                const value = e.target.value;
                setInputParams((prev) => ({
                    ...prev,
                    expectedAnnualAttempts:
                    value === "" ? "" : parseFloat(value),
                }));
                }}
                onBlur={() => refreshPage()}
                style={{
                  width: "100px",
                  padding: "6px 8px",
                  fontSize: "12px",
                  border: "2px solid #e8e8e8",
                  borderRadius: "6px",
                  outline: "none",
                  backgroundColor: "white",
                  color: "#1a2a3a",
                  transition: "all 0.2s ease",
                  cursor: "pointer",
                  boxShadow: "0 2px 4px rgba(194, 226, 249, 0.1)"
                }}
            />
            </div>
            <div
            style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "15px"
            }}
            >
            <label style={{ fontSize: "12px", fontWeight: "500", color: "#1a2a3a", flex: 1, textAlign: "left" }}>Expected Fatalities Per Success:</label>
            <input
                type="number"
                value={inputParams.expectedFatalitiesPerSuccessfulAttempt}
                onChange={(e) => {
                const value = e.target.value;
                setInputParams((prev) => ({
                    ...prev,
                    expectedFatalitiesPerSuccessfulAttempt:
                    value === "" ? "" : parseFloat(value),
                }));
                }}
                onBlur={() => refreshPage()}
                style={{
                  width: "100px",
                  padding: "6px 8px",
                  fontSize: "12px",
                  border: "2px solid #e8e8e8",
                  borderRadius: "6px",
                  outline: "none",
                  backgroundColor: "white",
                  color: "#1a2a3a",
                  transition: "all 0.2s ease",
                  cursor: "pointer",
                  boxShadow: "0 2px 4px rgba(194, 226, 249, 0.1)"
                }}
            />
            </div>
            <div
            style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "15px"
            }}
            >
            <label style={{ fontSize: "12px", fontWeight: "500", color: "#1a2a3a", flex: 1, textAlign: "left" }}>Queries Per Month:</label>
            <input
                type="number"
                min="0"
                step="1"
                value={inputParams.queriesAttackerExecutesPerMonth}
                onChange={(e) => {
                const value = e.target.value;
                setInputParams((prev) => ({
                    ...prev,
                    queriesAttackerExecutesPerMonth:
                    value === "" ? "" : parseFloat(value),
                }));
                }}
                onBlur={() => refreshPage()}
                style={{
                  width: "100px",
                  padding: "6px 8px",
                  fontSize: "12px",
                  border: "2px solid #e8e8e8",
                  borderRadius: "6px",
                  outline: "none",
                  backgroundColor: "white",
                  color: "#1a2a3a",
                  transition: "all 0.2s ease",
                  cursor: "pointer",
                  boxShadow: "0 2px 4px rgba(194, 226, 249, 0.1)"
                }}
            />
            </div>
        </div>
        </div>
    </div>
  );
};

export default ParameterSelector;
