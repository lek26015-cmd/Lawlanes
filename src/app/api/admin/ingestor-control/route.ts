import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { setSystemPaused } from '@/lib/ingestion-store';
import path from 'path';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action } = body;
        
        const projectRoot = process.cwd();

        if (action === 'pause') {
            console.log('🛑 Pausing ingestion system...');
            setSystemPaused(true);
            
            // Kill supervisor and any python ingestors
            // We use pkill -f to match the script names precisely
            const killCmd = `pkill -f supervisor.sh; pkill -f ingest-ratchakitcha; pkill -f ingest-krisdika; pkill -f ingest-ratchakitcha-historical.py`;
            
            exec(killCmd, (error) => {
                if (error) {
                    console.log('Note: Some processes might already be stopped:', error.message);
                }
            });
            
            return NextResponse.json({ success: true, message: 'Ingestion paused' });
        } 
        
        if (action === 'resume') {
            console.log('🚀 Resuming ingestion system...');
            setSystemPaused(false);
            
            const supervisorPath = path.join(projectRoot, 'scripts', 'supervisor.sh');
            const resumeCmd = `nohup ${supervisorPath} > supervisor.log 2>&1 &`;
            
            exec(resumeCmd, (error) => {
                if (error) {
                    console.error('Failed to resume supervisor:', error);
                }
            });
            
            return NextResponse.json({ success: true, message: 'Ingestion resumed' });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
