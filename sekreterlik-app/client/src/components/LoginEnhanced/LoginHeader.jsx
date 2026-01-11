import React from 'react';
import { motion } from 'framer-motion';

const LoginHeader = () => {
  return (
    <div className="text-center">
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ 
          type: "spring", 
          stiffness: 260, 
          damping: 20,
          delay: 0.1
        }}
        className="flex justify-center mb-6"
      >
        <div className="relative">
          {/* 3D Shadow Layers */}
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-400 to-purple-500 rounded-3xl transform rotate-6 blur-xl opacity-40 -z-10"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl transform -rotate-3 blur-lg opacity-30 -z-10"></div>
          {/* Main Icon Container */}
          <motion.div 
            whileHover={{ scale: 1.05, rotate: 5 }}
            className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-3xl p-5 shadow-2xl"
            style={{
              boxShadow: '0 20px 60px -15px rgba(99, 102, 241, 0.5), 0 0 0 1px rgba(255,255,255,0.1) inset, 0 1px 0 rgba(255,255,255,0.2) inset'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            {/* Inner glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-3xl pointer-events-none"></div>
          </motion.div>
        </div>
      </motion.div>
      
      <motion.h2 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
        className="text-3xl font-bold text-gray-900 mb-2"
      >
        Parti Sekreterliği Sistemi
      </motion.h2>
      
      <motion.p 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.4 }}
        className="text-gray-600"
      >
        Devam etmek için giriş yapın
      </motion.p>
    </div>
  );
};

export default LoginHeader;