// src/components/StudentCard.jsx
import React from 'react';

const StudentCard = ({ firstName, secondName, studentClass, onView }) => {
  return (
    <div className="bg-white shadow-md rounded-2xl p-4 mb-4 flex justify-between items-center">
      <div>
        <h3 className="text-lg font-semibold">{firstName} {secondName}</h3>
        <p className="text-gray-500">Class: {studentClass}</p>
      </div>
      <button
        onClick={onView}
        className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
      >
        View
      </button>
    </div>
  );
};

export default StudentCard;
