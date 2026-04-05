'use client';

import { branding, getCopyrightText } from '@/lib/branding';

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
        {/* Copyright */}
        {branding.showCopyright && (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {branding.copyright.url !== '#' ? (
              <a href={branding.copyright.url} className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                {getCopyrightText()}
              </a>
            ) : (
              getCopyrightText()
            )}
          </p>
        )}

        <div className="flex items-center gap-4">
          {/* Links */}
          {branding.privacyUrl !== '#' && (
            <a href={branding.privacyUrl} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              Privacy
            </a>
          )}
          {branding.termsUrl !== '#' && (
            <a href={branding.termsUrl} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              Terms
            </a>
          )}

          {/* Powered by */}
          {branding.showPoweredBy && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Powered by{' '}
              <span className="font-medium text-gray-500 dark:text-gray-400">{branding.appName}</span>
              {branding.showVersionBadge && (
                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400">
                  v{branding.version}
                </span>
              )}
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
