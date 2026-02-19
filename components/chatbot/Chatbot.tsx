
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RobotIcon } from '../icons/Icons';
import Card from '../ui/Card';
import { createChatSession } from '../../services/geminiService';
import { useAppContext } from '../../hooks/useAppContext';
import { ProductStatus, BotStatus } from '../../types';
import { Type, Chat, FunctionDeclaration, Part } from '@google/genai';
import { DEMAND_FORECAST_DATA } from '../../constants';

interface Message {
    text: string;
    sender: 'user' | 'ai';
}

const Chatbot: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [chat, setChat] = useState<Chat | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { products, bots } = useAppContext();
    const navigate = useNavigate();

    // === Define Advanced Tool Functions ===
    const tools: FunctionDeclaration[] = useMemo(() => [
        {
            name: 'navigate_to_page',
            description: 'Navigate to a specific control screen in the WIZO dashboard.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    page: {
                        type: Type.STRING,
                        description: 'Page: "dashboard", "inventory", "demand-forecast", "bot-control", "reports", "settings".',
                    },
                },
                required: ['page'],
            },
        },
        {
            name: 'query_warehouse_status',
            description: 'Get a comprehensive snapshot of the entire fulfillment center branch.',
            parameters: { type: Type.OBJECT, properties: {} }
        },
        {
            name: 'detailed_inventory_lookup',
            description: 'Search the product catalog with optional filters for category or stock level.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    category: { type: Type.STRING, description: 'Filter by category (Electronics, Kitchen, etc.)' },
                    status: { type: Type.STRING, description: 'Filter by "In Stock", "Low Stock", or "Out of Stock"' }
                }
            }
        },
        {
            name: 'analyze_fleet_efficiency',
            description: 'Get deep technical data on all autonomous bots including battery and throughput.',
            parameters: { type: Type.OBJECT, properties: {} }
        },
        {
            name: 'check_demand_forecast',
            description: 'Review the AI-predicted demand for the next 30 days to optimize logistics.',
            parameters: { type: Type.OBJECT, properties: {} }
        }
    ], []);

    const toolFunctions = useMemo(() => ({
        navigate_to_page: ({ page }: { page: string }) => {
            const pathMap: { [key: string]: string } = {
                'dashboard': '/', 'home': '/',
                'inventory': '/inventory',
                'demand-forecast': '/demand-forecast', 'demand': '/demand-forecast', 'forecast': '/demand-forecast',
                'bot-control': '/bot-control', 'bots': '/bot-control',
                'reports': '/reports',
                'settings': '/settings',
            };
            const path = pathMap[page.toLowerCase()];
            if (path) {
                navigate(path);
                return { success: `Taking you over to the ${page} screen!` };
            }
            return { error: `I couldn't find the ${page} page, sorry!` };
        },
        query_warehouse_status: () => {
            const totalStockValue = products.reduce((sum, p) => sum + (p.quantity * p.price), 0);
            const lowStockCount = products.filter(p => p.status === ProductStatus.LowStock).length;
            const activeBots = bots.filter(b => b.status === BotStatus.Active).length;
            const avgBattery = bots.reduce((sum, b) => sum + b.battery, 0) / bots.length;

            return {
                branchName: "Amazon/Walmart Unified Fulfillment Center",
                totalInventoryValue: `INR ${totalStockValue.toLocaleString()}`,
                lowStockAlerts: lowStockCount,
                activeBots: `${activeBots}/${bots.length}`,
                fleetBatteryAvg: `${Math.round(avgBattery)}%`,
                status: "Operational"
            };
        },
        detailed_inventory_lookup: ({ category, status }: { category?: string, status?: string }) => {
            let filtered = products;
            if (category) filtered = filtered.filter(p => p.category.toLowerCase() === category.toLowerCase());
            if (status) filtered = filtered.filter(p => p.status.toLowerCase() === status.toLowerCase());
            
            return {
                items: filtered.slice(0, 10).map(p => ({
                    id: p.id,
                    name: p.name,
                    qty: p.quantity,
                    price: p.price,
                    status: p.status
                })),
                totalCount: filtered.length
            };
        },
        analyze_fleet_efficiency: () => {
            return {
                fleet: bots.map(b => ({
                    id: b.id,
                    status: b.status,
                    battery: `${b.battery}%`,
                    tasks: b.tasksCompleted,
                    location: b.location
                }))
            };
        },
        check_demand_forecast: () => {
            const peaks = DEMAND_FORECAST_DATA.slice(0, 5).map(d => ({ day: d.name, demand: d.predicted }));
            return {
                forecastModel: "XGBoost-WIZO-v2",
                upcomingPeaks: peaks,
                overallTrend: "Bullish (+12% MoM)"
            };
        }
    }), [navigate, products, bots]);
    
    useEffect(() => {
        if(isOpen && !chat) {
            setChat(createChatSession(tools));
        }
    }, [isOpen, chat, tools]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };
    useEffect(scrollToBottom, [messages]);

    const handleSend = async () => {
        if (input.trim() === '' || isLoading || !chat) return;

        const userMessage: Message = { text: input, sender: 'user' };
        setMessages(prev => [...prev, userMessage]);
        const currentInput = input;
        setInput('');
        setIsLoading(true);

        try {
            let stream = await chat.sendMessageStream({ message: currentInput });
            let fullText = '';
            let functionCalls: any[] = [];

            for await (const chunk of stream) {
                if (chunk.functionCalls) {
                    functionCalls.push(...chunk.functionCalls);
                }
                if (chunk.text) fullText += chunk.text;
            }

            if (functionCalls.length > 0) {
                // Initial "Thinking" message
                setMessages(prev => [...prev, { text: fullText || "Checking that for you, one sec!", sender: 'ai' }]);

                const toolResponses: { id: string; name: string; response: any; }[] = [];
                for (const call of functionCalls) {
                    const toolFunction = (toolFunctions as any)[call.name];
                    if (toolFunction) {
                        const result = await Promise.resolve(toolFunction(call.args));
                        toolResponses.push({ id: call.id, name: call.name, response: result });
                    }
                }
                
                const functionResponseParts: Part[] = toolResponses.map(
                  (tr) => ({ functionResponse: { name: tr.name, response: tr.response } })
                );
                
                stream = await chat.sendMessageStream({ message: functionResponseParts });
                
                setMessages(prev => [...prev, { text: '', sender: 'ai' }]);
                for await (const chunk of stream) {
                    setMessages(prev => {
                        const newMessages = [...prev];
                        newMessages[newMessages.length-1].text += chunk.text;
                        return newMessages;
                    });
                }
            } else {
                setMessages(prev => [...prev, { text: fullText, sender: 'ai' }]);
            }
        } catch (error) {
            console.error("Chatbot error:", error);
            setMessages(prev => [...prev, { text: "Hey, sorry about that! Something went wrong on my end. Can you try again?", sender: 'ai' }]);
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-8 right-8 w-16 h-16 bg-neon-blue rounded-full text-white flex items-center justify-center shadow-lg shadow-neon-blue/50 hover:scale-110 transition-transform z-50 group"
                aria-label="Toggle AI Link"
            >
                <RobotIcon className="w-8 h-8 group-hover:animate-pulse" />
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon-green opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-neon-green"></span>
                </span>
            </button>

            {isOpen && (
                <div className="fixed inset-0 sm:inset-auto sm:bottom-28 sm:right-8 w-full sm:w-[450px] h-full sm:h-[600px] z-50">
                    <Card className="flex flex-col h-full !p-0 rounded-none sm:rounded-2xl border-neon-blue/30 overflow-hidden">
                        <header className="p-4 bg-neon-blue text-dark-bg flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <RobotIcon className="w-6 h-6" />
                                <h3 className="font-bold">WIZO</h3>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-[10px] font-mono animate-pulse">Ready to help!</span>
                                <button onClick={() => setIsOpen(false)} className="text-2xl leading-none">&times;</button>
                            </div>
                        </header>
                        <div className="flex-1 p-4 overflow-y-auto bg-dark-bg/95 font-sans">
                            <div className="flex flex-col gap-4">
                                {messages.length === 0 && (
                                    <div className="text-center py-10 opacity-50">
                                        <RobotIcon className="w-12 h-12 mx-auto mb-4 text-neon-blue" />
                                        <p className="text-sm">Hey! I'm WIZO. <br/> What's happening in the warehouse today?</p>
                                    </div>
                                )}
                                {messages.map((msg, index) => (
                                    <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] px-4 py-3 rounded-2xl ${msg.sender === 'user' ? 'bg-neon-blue/20 text-white border border-neon-blue/40 rounded-br-none' : 'bg-white/5 text-gray-200 border border-white/10 rounded-bl-none shadow-xl'}`}>
                                            <p className="text-sm whitespace-pre-wrap leading-relaxed">
                                                {msg.text}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>
                        </div>
                        <footer className="p-4 border-t border-white/10 bg-black/40">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                                    placeholder="Hey! What's on your mind?"
                                    className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-neon-blue focus:ring-1 focus:ring-neon-blue text-white placeholder-gray-600 outline-none"
                                    disabled={isLoading}
                                />
                                <button onClick={handleSend} className="px-6 py-2 bg-neon-blue text-dark-bg font-bold rounded-xl hover:shadow-neon-blue transition-all disabled:opacity-50" disabled={isLoading || !input.trim()}>
                                    {isLoading ? '...' : 'Send'}
                                </button>
                            </div>
                        </footer>
                    </Card>
                </div>
            )}
            <style>{`
                .whitespace-pre-wrap { white-space: pre-wrap; word-break: break-word; }
            `}</style>
        </>
    );
};

export default Chatbot;
