import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AthleteRegistration from './pages/AthleteRegistration';
import NationalChampionshipRegistration from './pages/NationalChampionshipRegistration';
import AdminPanel from './pages/AdminPanel';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/national-championship" element={<NationalChampionshipRegistration />} />
          <Route path="/athlete-registration" element={<AthleteRegistration />} />
          <Route path="/" element={<NationalChampionshipRegistration />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
