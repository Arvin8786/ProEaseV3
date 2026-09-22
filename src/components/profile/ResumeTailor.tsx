import React, { useState } from 'react';
import { UserProfile } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Sparkles, 
  FileText, 
  Target, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight,
  Loader2,
  Download,
  Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateResume, analyzeResumeGap } from '@/services/gemini';
import { DocumentPreviewer } from '@/components/workspace/DocumentPreviewer';
import { updateLocalProfileField } from '@/lib/profileStorage';

interface ResumeTailorProps {
  profile: UserProfile | null;
}

export function ResumeTailor({ profile }: ResumeTailorProps) {
  const [jobDescription, setJobDescription] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!profile) return null;

  const handleCopySuggestion = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleGenerateTailored = async () => {
    setIsGenerating(true);
    try {
      // Extract position title from JD if possible (simple heuristic)
      const positionMatch = jobDescription.match(/(?:Position|Role|Job Title):\s*([^\n\r]+)/i);
      const position = positionMatch ? positionMatch[1].trim() : "Custom Tailored Role";

      const content = await generateResume(profile, position);
      await updateLocalProfileField(profile!.uid, {
        activities: [
          {
            id: Math.random().toString(36).substr(2, 9),
            type: 'document',
            action: 'generated',
            detail: `Generated interview-tailored resume for role: ${position}`,
            timestamp: new Date(),
            link: '/#profile'
          } as any,
          ...(profile.activities || [])
        ].slice(0, 50),
        updatedAt: new Date()
      });

      setPreviewDoc({
        type: 'tailored_resume',
        date: new Date().toLocaleDateString(),
        content,
        position
      });
      setIsPreviewOpen(true);
    } catch (error) {
      console.error("Generation failed:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnalyze = async () => {
    if (!jobDescription.trim()) return;
    setIsAnalyzing(true);
    
    try {
      const result = await analyzeResumeGap(profile, jobDescription);
      if (result) {
        setAnalysis(result);
      } else {
        alert("AI was unable to analyze this job description. Please ensure the text is clear.");
      }
    } catch (error) {
      console.error("AI Analysis Failed:", error);
      alert("Something went wrong during the AI analysis. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Interview-Tailored Resume
          </h2>
          <p className="text-sm text-muted-foreground">Paste a job description to generate a perfect match resume.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Job Description</CardTitle>
              <CardDescription>Paste the full text of the job you're applying for</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea 
                placeholder="Paste Job Description here..." 
                className="min-h-[300px] resize-none"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
              />
              <Button 
                className="w-full py-6 text-lg" 
                onClick={handleAnalyze}
                disabled={isAnalyzing || !jobDescription.trim()}
              >
                {isAnalyzing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
                Analyze Match & Tailor
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {!analysis && !isAnalyzing ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                <FileText className="h-16 w-12 text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-slate-400">Analysis Results</h3>
                <p className="text-sm text-slate-400 max-w-xs">
                  Your gap analysis and tailoring suggestions will appear here after processing.
                </p>
              </div>
            ) : isAnalyzing ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-12 space-y-4">
                <div className="relative">
                  <div className="h-24 w-24 rounded-full border-4 border-primary/10 border-t-primary animate-spin" />
                  <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold">AI Gap Analysis</h3>
                <p className="text-muted-foreground">Comparing your career vault against the job requirements...</p>
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <Card className="bg-slate-900 text-white overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-6">
                    <div className="text-4xl font-bold text-primary">{analysis.matchScore}%</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-widest text-right">Match Score</div>
                  </div>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-400" />
                      Gap Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase mb-2">Missing Keywords</p>
                      <div className="flex flex-wrap gap-2">
                        {analysis.missingKeywords.map((kw: string) => (
                          <span key={kw} className="bg-white/10 px-2 py-1 rounded text-xs">{kw}</span>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <h3 className="font-bold flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Tailoring Suggestions
                  </h3>
                  {analysis.tailoringEdits.map((edit: any, i: number) => (
                    <Card key={i} className="border-l-4 border-l-primary">
                      <CardContent className="p-4 space-y-3">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">Original</p>
                          <p className="text-sm text-slate-500 line-through">{edit.original}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-primary uppercase">Suggested</p>
                          <p className="text-sm font-medium">{edit.suggested}</p>
                        </div>
                        <div className="pt-2 border-t flex items-center justify-between">
                          <p className="text-[10px] text-muted-foreground italic flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {edit.reason}
                          </p>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-7 px-2 text-[10px] text-primary hover:text-primary hover:bg-primary/5"
                            onClick={() => handleCopySuggestion(edit.suggested, i)}
                          >
                            {copiedIndex === i ? (
                              <>
                                <CheckCircle2 className="mr-1 h-3 w-3 text-green-500 animate-bounce" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="mr-1 h-3 w-3" />
                                Apply (Copy)
                              </>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Card className="bg-blue-50 border-blue-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-blue-700">
                      <Info className="h-4 w-4" />
                      ATS Optimization Tips
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {analysis.atsTips.map((tip: string, i: number) => (
                        <li key={i} className="text-xs text-blue-600 flex items-start gap-2">
                          <div className="mt-1 h-1 w-1 rounded-full bg-blue-400 shrink-0" />
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Button 
                  className="w-full py-6" 
                  onClick={handleGenerateTailored}
                  disabled={isGenerating}
                >
                  {isGenerating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Download className="mr-2 h-5 w-5" />}
                  {isGenerating ? 'Generating...' : 'Generate Customized PDF'}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <DocumentPreviewer 
        isOpen={isPreviewOpen} 
        onClose={() => setIsPreviewOpen(false)} 
        document={previewDoc} 
        profile={profile}
      />
    </div>
  );
}

function Info({ className }: { className?: string }) {
  return <AlertCircle className={className} />;
}
