import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import './contrast.css';
import './brand.css';
import './map.css';
import './ui.css';
import './shopping.css';
import './catalog-layout.css';
import './feedback.css';
import './motion.css';
import './header-actions.css';
import './catalog-controls.css';
import './dark-theme.css';
class Boundary extends React.Component {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<main className="setup"><h1>頁面暫時無法顯示</h1><p>請重新載入；若持續發生，請聯絡管理員。</p><button onClick={()=>location.reload()}>重新載入</button></main>:this.props.children;}
}
createRoot(document.getElementById('root')).render(<Boundary><App/></Boundary>);
