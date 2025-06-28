# MindStore 🎤✨

A beautiful voice journal application that transforms your thoughts into written memories using the power of speech recognition. Built with modern web technologies and featuring a stunning glassmorphism interface.

## ✨ Features

- **🎤 Voice Recognition**: Real-time speech-to-text using Web Speech API
- **💾 Local Storage**: All data stored locally using IndexedDB
- **🎨 Glassmorphism UI**: Beautiful backdrop blur effects and animations
- **📱 Responsive Design**: Works perfectly on desktop and mobile devices
- **⚡ Real-time Transcription**: See your words appear as you speak
- **🗑️ Entry Management**: Delete entries with smooth animations
- **📊 Statistics**: Track your daily and weekly entry counts
- **🔒 Privacy First**: No external APIs, your data stays private

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 with TypeScript
- **Styling**: Tailwind CSS + Framer Motion
- **Speech Recognition**: Web Speech API (built-in browser API)
- **Storage**: IndexedDB for local data persistence
- **Deployment**: Vercel (free tier)

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- Modern browser with Web Speech API support (Chrome, Edge, Safari)

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd mindstore
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## 🎯 Usage

1. **Start Recording**: Click the microphone button to begin voice recording
2. **Speak Clearly**: Talk naturally - your words will appear in real-time
3. **Auto-Save**: Entries are automatically saved when you finish speaking
4. **View Entries**: Scroll down to see all your MindStore entries
5. **Delete Entries**: Hover over entries and click the delete button

## 🌟 Key Features Explained

### Voice Recognition
- Uses the Web Speech API for real-time transcription
- Supports continuous recording with interim results
- Automatic confidence scoring
- Error handling for unsupported browsers

### Glassmorphism Design
- Backdrop blur effects for modern glass appearance
- Semi-transparent backgrounds with subtle borders
- Smooth hover animations and transitions
- Responsive design that works on all devices

### Local Storage
- IndexedDB for reliable local data storage
- No external database required
- Data persists between browser sessions
- Automatic sorting by timestamp

## 📱 Browser Support

- ✅ Chrome (recommended)
- ✅ Edge
- ✅ Safari
- ❌ Firefox (limited Web Speech API support)

## 🚀 Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Deploy automatically with zero configuration

### Environment Variables

No environment variables required! The app uses only browser APIs.

## 🎨 Customization

### Colors and Themes
Edit `src/app/globals.css` to customize:
- Background gradients
- Glassmorphism effects
- Color schemes

### Animations
Modify Framer Motion animations in components:
- Entry animations
- Page transitions
- Microphone pulse effects

## 🔧 Development

### Project Structure
```
src/
├── app/
│   ├── globals.css      # Global styles and Tailwind config
│   ├── layout.tsx       # Root layout component
│   └── page.tsx         # Main page component
├── components/
│   ├── VoiceRecorder.tsx    # Speech recognition component
│   ├── DiaryEntry.tsx       # Individual entry display
│   ├── EntryList.tsx        # List of all entries
│   └── GlassmorphismCard.tsx # Reusable card component
└── lib/
    ├── speechRecognition.ts # Web Speech API wrapper
    ├── indexedDB.ts         # Database operations
    └── utils.ts             # Utility functions
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- Web Speech API for voice recognition
- Framer Motion for smooth animations
- Tailwind CSS for beautiful styling
- Next.js team for the amazing framework

---

**Built with ❤️ using modern web technologies** 