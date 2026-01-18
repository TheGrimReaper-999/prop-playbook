import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Upload, Database, CheckCircle, AlertCircle } from 'lucide-react';

interface LogEntry {
  message: string;
  type: 'info' | 'success' | 'error';
  time: string;
}

const ImportData = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  const log = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { message, type, time }]);
  };

  const sendBatch = async (type: string, data: any[]) => {
    const { data: result, error } = await supabase.functions.invoke('import-sqlite', {
      body: { type, data }
    });
    if (error) throw error;
    return result;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'fixtures' | 'stats') => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    log(`Reading ${file.name}...`);

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      log(`Parsed ${data.length} ${type}. Importing in batches...`);
      
      const batchSize = type === 'fixtures' ? 50 : 200;
      let total = 0;
      
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        try {
          const result = await sendBatch(type, batch);
          if (result.error) {
            log(`Error in batch ${Math.floor(i/batchSize) + 1}: ${result.error}`, 'error');
          } else {
            total += result.inserted || batch.length;
            log(`Batch ${Math.floor(i/batchSize) + 1}: Imported ${batch.length} ${type} (total: ${total})`);
          }
        } catch (err: any) {
          log(`Error: ${err.message}`, 'error');
        }
      }
      
      log(`✅ ${type} import complete! Total: ${total}`, 'success');
    } catch (err: any) {
      log(`Failed to parse file: ${err.message}`, 'error');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
            <Database className="w-8 h-8" />
            NBA Data Import Tool
          </h1>
          <p className="text-muted-foreground mt-2">
            Import fixtures and player stats from JSON files
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Import Fixtures
              </CardTitle>
            </CardHeader>
            <CardContent>
              <input
                type="file"
                accept=".json"
                onChange={(e) => handleFileUpload(e, 'fixtures')}
                disabled={isImporting}
                className="block w-full text-sm text-muted-foreground
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary file:text-primary-foreground
                  hover:file:bg-primary/90
                  disabled:opacity-50"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Select fixtures.json file
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Import Player Stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <input
                type="file"
                accept=".json"
                onChange={(e) => handleFileUpload(e, 'stats')}
                disabled={isImporting}
                className="block w-full text-sm text-muted-foreground
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary file:text-primary-foreground
                  hover:file:bg-primary/90
                  disabled:opacity-50"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Select player_stats.json file
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Import Log</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setLogs([])}>
              Clear
            </Button>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 rounded-lg p-4 h-80 overflow-y-auto font-mono text-sm space-y-1">
              {logs.length === 0 ? (
                <p className="text-muted-foreground">No logs yet. Select a file to import.</p>
              ) : (
                logs.map((entry, i) => (
                  <div key={i} className={`flex items-start gap-2 ${
                    entry.type === 'success' ? 'text-green-500' :
                    entry.type === 'error' ? 'text-red-500' : 'text-blue-500'
                  }`}>
                    {entry.type === 'success' ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> :
                     entry.type === 'error' ? <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> : null}
                    <span className="text-muted-foreground">[{entry.time}]</span>
                    <span>{entry.message}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ImportData;