import React from 'react'

interface PromptPayLogoProps {
  className?: string
  width?: number | string
  height?: number | string
}

import Image from 'next/image'

export const PromptPayLogo: React.FC<PromptPayLogoProps> = ({ 
  className = "", 
  width = 120, 
  height = 40 
}) => {
  return (
    <div className={className} style={{ width, height, position: 'relative' }}>
        <Image 
            src="/images/prompt-pay-logo-1024x342.png" 
            alt="PromptPay"
            fill
            className="object-contain"
        />
    </div>
  )
}
