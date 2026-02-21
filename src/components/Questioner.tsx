import "../css/questioner.css";

const Questioner = () => {
  return (
    <div className="quiz-container">
      <div className="question-box">What is the capital of France?</div>

      <div className="choices">
        <div className="choice red">Berlin</div>
        <div className="choice blue">Madrid</div>
        <div className="choice yellow">Paris</div>
        <div className="choice green">Rome</div>
      </div>
    </div>
  );
};

export default Questioner;
