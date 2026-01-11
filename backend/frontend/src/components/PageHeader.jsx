import { motion } from 'framer-motion'

export default function PageHeader({ icon: Icon, title, subtitle, actions, onHomeClick, homeLabel, dir = 'rtl' }) {
  return (
    <header className="px-6 py-4 bg-gradient-to-r from-primary-700 to-primary-600 text-white shadow-lg" dir={dir}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {Icon ? (
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm">
              <Icon size={20} />
            </div>
          ) : null}
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            {subtitle ? (<p className="text-sm opacity-90">{subtitle}</p>) : null}
          </div>
        </div>
        <div className="flex gap-2 items-center">
          {onHomeClick ? (
            <motion.button
              whileHover={{ scale: 1.05, backgroundColor: "rgba(255,255,255,0.2)" }}
              whileTap={{ scale: 0.95 }}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg backdrop-blur-sm border border-white/20"
              onClick={onHomeClick}
            >
              {homeLabel || 'Home'}
            </motion.button>
          ) : null}
          {Array.isArray(actions) ? actions.map((btn, i) => (
            <div key={i}>{btn}</div>
          )) : actions}
        </div>
      </div>
    </header>
  )
}

