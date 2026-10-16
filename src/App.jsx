import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ProfileProvider } from './contexts/ProfileContext';
import { SceneProvider } from './contexts/SceneContext';
import SceneRouter from './kitchens/SceneRouter';
import OriginalRouter from './pages/OriginalRouter';

import './styles/base.css';
import './styles/components.css';
import './styles/scenes.css';
import './styles/overlays.css';
import './styles/transitions.css';
import './styles/ambient.css';

function App() {
  return (
    <BrowserRouter>
      <ProfileProvider>
        <SceneProvider>
          <Routes>
            {/* Original form-based site at /original/* */}
            <Route path="/original/*" element={<OriginalRouter />} />
            {/* 2.5D inn — catch-all */}
            <Route path="/*" element={<SceneRouter />} />
          </Routes>
        </SceneProvider>
      </ProfileProvider>
    </BrowserRouter>
  );
}

export default App;
