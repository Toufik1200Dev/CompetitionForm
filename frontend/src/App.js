import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AthleteRegistration from './pages/AthleteRegistration';
import NationalChampionshipRegistration from './pages/NationalChampionshipRegistration';
import CoachingRegistration from './pages/CoachingRegistration';
import AdminPanel from './pages/AdminPanel';
import PublicUserProfile from './pages/PublicUserProfile';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/national-championship" element={<NationalChampionshipRegistration />} />
          <Route path="/athlete-registration" element={<AthleteRegistration />} />
          <Route path="/coaching-registrations" element={<CoachingRegistration />} />
          <Route path="/u/:uid" element={<PublicUserProfile />} />
          <Route path="/" element={<NationalChampionshipRegistration />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
