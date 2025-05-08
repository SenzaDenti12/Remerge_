'use client'

import VideoCreator from '../../components/video-creator'
import { Container } from '../../components/ui/container'

export default function GeneratePage() {
  return (
    <Container>
      <div className="py-6 md:py-10">
        <h1 className="text-3xl md:text-4xl font-bold text-gradient mb-4">
          AI Video Generator
        </h1>
        <p className="text-muted-foreground max-w-3xl mb-8">
          Turn your portrait into a speaking video. Upload your image, review the AI-generated script, and get a professional video in minutes.
        </p>
        
        <VideoCreator />
      </div>
    </Container>
  )
} 